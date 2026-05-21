import { Injectable, Logger } from '@nestjs/common';
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
   * Generates Leaderboards.
   * Orchestrated to run AFTER the EOD Portfolio Snapshot finishes.
   */
  async generateRankings() {
    this.logger.log('🏆 Starting Leaderboard ZSET generation...');

    const lockToken = await this.redis.acquireLock('cron:leaderboard', 3600);
    if (!lockToken) {
      this.logger.log('Leaderboard job is already running on another instance. Skipping.');
      return;
    }

    const startTime = Date.now();
    
    try {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      const day7Ago = new Date(today); day7Ago.setDate(day7Ago.getDate() - 7);
      const day30Ago = new Date(today); day30Ago.setDate(day30Ago.getDate() - 30);
      const day365Ago = new Date(today); day365Ago.setDate(day365Ago.getDate() - 365);

      let eligibleCount = 0;
      let totalEvaluated = 0;
      let lastCursor: string | undefined = undefined;
      let hasMore = true;

      // Wipe current leaderboards to cleanly rebuild
      const existingKeys = await this.redis.getClient().keys(`${LEADERBOARD_PREFIX}*`);
      if (existingKeys.length > 0) {
        const delPipeline = this.redis.getClient().pipeline();
        delPipeline.del(...existingKeys);
        await delPipeline.exec();
      }

      while (hasMore) {
        const users: any[] = await this.prisma.user.findMany({
          take: 1000,
          ...(lastCursor ? { skip: 1, cursor: { id: lastCursor } } : {}),
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
          orderBy: { id: 'asc' },
        });

        if (users.length === 0) {
          hasMore = false;
          break;
        }

        lastCursor = users[users.length - 1].id;
        const pipeline = this.redis.getClient().pipeline();

        for (const user of users) {
          if (!user.portfolio) continue;

          const totalPortfolioValue = Number(user.portfolio.balance) + Number(user.portfolio.currentValue);

          if (totalPortfolioValue < 5000) continue;

          const snapshots = await this.prisma.portfolioDailySnapshot.findMany({
            where: { userId: user.id },
            orderBy: { snapshotDate: 'desc' },
            take: 365,
          });

          if (snapshots.length === 0) continue;

          const latest = snapshots[0];
          const hasTradeHistory = latest.totalTrades >= 5;

          const getSnapshotClosestTo = (targetDate: Date) => {
            return snapshots.find(s => s.snapshotDate <= targetDate) || snapshots[snapshots.length - 1];
          };

          const snap7 = getSnapshotClosestTo(day7Ago);
          const snap30 = getSnapshotClosestTo(day30Ago);
          const snap365 = getSnapshotClosestTo(day365Ago);

          const calculateReturn = (oldSnap: any) => {
            if (!oldSnap) return 0;
            const oldVal = Number(oldSnap.balance) + Number(oldSnap.investedValue);
            if (oldVal <= 0) return 0;
            return ((totalPortfolioValue - oldVal) / oldVal) * 100;
          };

          const returns = {
            daily: Number(latest.dayPnlPercent),
            weekly: calculateReturn(snap7),
            monthly: calculateReturn(snap30),
            yearly: calculateReturn(snap365),
            all_time: Number(user.portfolio.totalPnl) / (Number(user.portfolio.investedValue) || 1) * 100,
          };

          const realizedPnL = {
            daily: Number(latest.dayPnl),
            weekly: Number(latest.totalPnl) - Number(snap7?.totalPnl || 0),
            monthly: Number(latest.totalPnl) - Number(snap30?.totalPnl || 0),
            yearly: Number(latest.totalPnl) - Number(snap365?.totalPnl || 0),
            all_time: Number(user.portfolio.totalPnl), 
          };

          const scopes = ['global'];
          if (user.state) scopes.push(`state:${user.state.toLowerCase()}`);
          if (user.city) scopes.push(`city:${user.city.toLowerCase()}`);

          const timeframes: Timeframe[] = ['daily', 'weekly', 'monthly', 'yearly', 'all_time'];

          for (const scope of scopes) {
            for (const tf of timeframes) {
              pipeline.zadd(`${LEADERBOARD_PREFIX}${scope}:${tf}:return_percent`, returns[tf], user.id);
              pipeline.zadd(`${LEADERBOARD_PREFIX}${scope}:${tf}:realized_pnl`, realizedPnL[tf], user.id);
            }
            if (hasTradeHistory) {
               pipeline.zadd(`${LEADERBOARD_PREFIX}${scope}:all_time:win_rate`, Number(latest.winRate), user.id);
            }
          }
          eligibleCount++;
        }

        // Execute batch writes
        await pipeline.exec();
        totalEvaluated += users.length;

        // Yield event loop to prevent blocking background tasks
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const elapsed = Date.now() - startTime;
      this.logger.log(`🏆 Leaderboards generated successfully! Evaluated ${totalEvaluated} users, ${eligibleCount} eligible. Took ${elapsed}ms.`);
    } catch (error) {
      this.logger.error(`Leaderboard generation failed: ${error}`);
    } finally {
      await this.redis.releaseLock('cron:leaderboard', lockToken);
      this.logger.log('🔒 Released leaderboard lock.');
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
