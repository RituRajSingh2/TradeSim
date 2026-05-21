import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../redis/redis.service';

const LEADERBOARD_PREFIX = 'leaderboard:';

export type Timeframe = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'all_time';
export type Metric = 'return_percent' | 'realized_pnl' | 'win_rate';

@Injectable()
export class LeaderboardService {
  private readonly logger = new Logger(LeaderboardService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * CRON: Generates Leaderboards once a day at 4:00 PM IST (10:30 UTC).
   * Runs shortly after the EOD Portfolio Snapshot finishes.
   */
  @Cron('30 10 * * 1-5', {
    name: 'generate-leaderboards',
    timeZone: 'UTC',
  })
  async generateRankings() {
    this.logger.log('🏆 Starting Leaderboard ZSET generation...');
    const startTime = Date.now();
    const pipeline = this.redis.getClient().pipeline();

    try {
      // 1. Fetch current users and their latest EOD snapshot
      // We only consider users who are active
      const users = await this.prisma.user.findMany({
        where: { isActive: true, deletedAt: null },
        select: {
          id: true,
          state: true,
          city: true,
          portfolio: {
            select: {
              balance: true,
              investedValue: true,
              currentValue: true,
              totalPnl: true,
            }
          }
        },
      });

      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      // Pre-calculate threshold dates for trailing rolling deltas
      const day7Ago = new Date(today); day7Ago.setDate(day7Ago.getDate() - 7);
      const day30Ago = new Date(today); day30Ago.setDate(day30Ago.getDate() - 30);
      const day365Ago = new Date(today); day365Ago.setDate(day365Ago.getDate() - 365);

      let eligibleCount = 0;

      // Wipe current leaderboards to cleanly rebuild
      const existingKeys = await this.redis.getClient().keys(`${LEADERBOARD_PREFIX}*`);
      if (existingKeys.length > 0) {
        pipeline.del(...existingKeys);
      }

      for (const user of users) {
        if (!user.portfolio) continue;

        const totalPortfolioValue = Number(user.portfolio.balance) + Number(user.portfolio.currentValue);

        // --- ELIGIBILITY & FAIRNESS RULES ---
        // Rule 1: Minimum portfolio size > ₹5,000
        if (totalPortfolioValue < 5000) continue;

        // Fetch their historical snapshots to compute rolling deltas
        // Note: For extreme scale, this query should be optimized or batched.
        const snapshots = await this.prisma.portfolioDailySnapshot.findMany({
          where: { userId: user.id },
          orderBy: { snapshotDate: 'desc' },
          take: 365, // Max needed for yearly
        });

        // Need at least 1 snapshot to rank
        if (snapshots.length === 0) continue;

        const latest = snapshots[0];
        
        // Rule 2: Minimum Activity (At least 5 trades to rank by Win Rate)
        const hasTradeHistory = latest.totalTrades >= 5;

        // Extract historical anchors
        const getSnapshotClosestTo = (targetDate: Date) => {
          // Snapshots are descending (newest first). We want the first one <= targetDate
          return snapshots.find(s => s.snapshotDate <= targetDate) || snapshots[snapshots.length - 1];
        };

        const snap7 = getSnapshotClosestTo(day7Ago);
        const snap30 = getSnapshotClosestTo(day30Ago);
        const snap365 = getSnapshotClosestTo(day365Ago);

        // Calculate Returns (Delta)
        const calculateReturn = (oldSnap: any) => {
          if (!oldSnap) return 0;
          const oldVal = Number(oldSnap.balance) + Number(oldSnap.investedValue); // original cost basis + cash
          if (oldVal <= 0) return 0;
          return ((totalPortfolioValue - oldVal) / oldVal) * 100;
        };

        const returns = {
          daily: Number(latest.dayPnlPercent), // Daily is native to the snapshot
          weekly: calculateReturn(snap7),
          monthly: calculateReturn(snap30),
          yearly: calculateReturn(snap365),
          all_time: Number(user.portfolio.totalPnl) / (Number(user.portfolio.investedValue) || 1) * 100, // simplified all-time
        };

        const realizedPnL = {
          daily: Number(latest.dayPnl),
          weekly: Number(latest.totalPnl) - Number(snap7?.totalPnl || 0), // Rough proxy, ideally we track realized specifically over time
          monthly: Number(latest.totalPnl) - Number(snap30?.totalPnl || 0),
          yearly: Number(latest.totalPnl) - Number(snap365?.totalPnl || 0),
          all_time: Number(user.portfolio.totalPnl), 
        };

        // Populate Scopes
        const scopes = ['global'];
        if (user.state) scopes.push(`state:${user.state.toLowerCase()}`);
        if (user.city) scopes.push(`city:${user.city.toLowerCase()}`);

        const timeframes: Timeframe[] = ['daily', 'weekly', 'monthly', 'yearly', 'all_time'];

        for (const scope of scopes) {
          for (const tf of timeframes) {
            // Rank by Return Percent
            pipeline.zadd(`${LEADERBOARD_PREFIX}${scope}:${tf}:return_percent`, returns[tf], user.id);
            // Rank by PnL
            pipeline.zadd(`${LEADERBOARD_PREFIX}${scope}:${tf}:realized_pnl`, realizedPnL[tf], user.id);
          }

          // Rank by Win Rate (Only for All-Time and Monthly if they have trade history)
          if (hasTradeHistory) {
             pipeline.zadd(`${LEADERBOARD_PREFIX}${scope}:all_time:win_rate`, Number(latest.winRate), user.id);
          }
        }
        
        eligibleCount++;
      }

      await pipeline.exec();
      const elapsed = Date.now() - startTime;
      this.logger.log(`🏆 Leaderboards generated successfully! Evaluated ${users.length} users, ${eligibleCount} eligible. Took ${elapsed}ms.`);
    } catch (error) {
      this.logger.error(`Leaderboard generation failed: ${error}`);
    }
  }

  /**
   * Retrieves the Top 100 for a specific leaderboard.
   */
  async getTopRanking(scope: string, timeframe: string, metric: string, limit = 100) {
    const key = `${LEADERBOARD_PREFIX}${scope}:${timeframe}:${metric}`;
    
    // Get top IDs and their scores
    const rawData = await this.redis.getClient().zrevrange(key, 0, limit - 1, 'WITHSCORES');
    
    if (!rawData || rawData.length === 0) return [];

    const rankings = [];
    for (let i = 0; i < rawData.length; i += 2) {
      rankings.push({
        userId: rawData[i],
        score: parseFloat(rawData[i + 1]),
        rank: (i / 2) + 1,
      });
    }

    // Resolve User Profiles
    const userIds = rankings.map(r => r.userId);
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        name: true,
        avatarUrl: true,
        city: true,
        state: true,
      }
    });

    const userMap = new Map(users.map(u => [u.id, u]));

    return rankings.map(r => ({
      ...r,
      user: userMap.get(r.userId) || { id: r.userId, name: 'AnonymousTrader' }
    }));
  }

  /**
   * Retrieves a specific user's rank.
   */
  async getUserRank(userId: string, scope: string, timeframe: string, metric: string) {
    const key = `${LEADERBOARD_PREFIX}${scope}:${timeframe}:${metric}`;
    
    const [rank, score] = await Promise.all([
      this.redis.getClient().zrevrank(key, userId),
      this.redis.getClient().zscore(key, userId)
    ]);

    if (rank === null) return null;

    return {
      rank: rank + 1, // 0-indexed
      score: parseFloat(score as string),
    };
  }
}
