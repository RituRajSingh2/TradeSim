import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { MarketService } from '../market/market.service';

const INTRADAY_PREFIX = 'portfolio:intraday:';
const INTRADAY_TTL = 86400 * 2; // 48 hours to be safe for a "1D" chart lookup

export interface EquityPoint {
  time: number; // unix timestamp seconds
  value: number; // total portfolio value (cash + holdings)
}

@Injectable()
export class PortfolioHistoryService {
  private readonly logger = new Logger(PortfolioHistoryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly marketService: MarketService,
  ) {}

  /**
   * CRON: Every 5 minutes, Mon-Fri, 9:15 AM to 3:30 PM IST.
   * Logs a snapshot of every active portfolio into Redis ZSET for the 1D chart.
   */
  @Cron('*/5 9-15 * * 1-5', {
    name: 'intraday-portfolio-snapshot',
    timeZone: 'Asia/Kolkata',
  })
  async logIntradaySnapshots() {
    // 1. Check if market is open before doing expensive aggregations
    const status = await this.marketService.getMarketStatus();
    if (!status.isOpen) {
      return; // Skip if market is closed, even if cron fires
    }

    const startTime = Date.now();
    let processed = 0;

    // 2. Fetch all portfolios
    // In a massive system this would be paginated, but for now we fetch all
    const portfolios = await this.prisma.portfolio.findMany({
      where: { user: { isActive: true, deletedAt: null } },
      select: { userId: true, balance: true, currentValue: true },
    });

    const pipeline = this.redis.getClient().pipeline();
    const timestamp = Math.floor(Date.now() / 1000);

    for (const p of portfolios) {
      const totalValue = Number(p.balance) + Number(p.currentValue);
      const key = `${INTRADAY_PREFIX}${p.userId}`;
      
      // Store compact array [time, value] to minimize Redis memory
      const compact = [timestamp, totalValue];
      pipeline.zadd(key, timestamp, JSON.stringify(compact));
      pipeline.expire(key, INTRADAY_TTL);
      processed++;
    }

    await pipeline.exec();

    const elapsed = Date.now() - startTime;
    this.logger.debug(`🕒 Logged 5-min intraday snapshots for ${processed} portfolios in ${elapsed}ms`);
  }

  /**
   * Returns equity curve history for a user.
   * Range can be '1d', '1w', '1mo', '1y', 'all'.
   */
  async getEquityCurve(userId: string, range: string): Promise<EquityPoint[]> {
    if (range === '1d') {
      return this.getIntradayCurve(userId);
    }
    return this.getHistoricalCurve(userId, range);
  }

  /**
   * Resolves the 1D intraday curve natively from the 5-min Redis ZSET.
   */
  private async getIntradayCurve(userId: string): Promise<EquityPoint[]> {
    const key = `${INTRADAY_PREFIX}${userId}`;
    const now = Math.floor(Date.now() / 1000);
    const startOfDay = now - 86400; // Look back 24 hours to cover the whole session

    // Fetch from Redis
    const rawData = await this.redis.getClient().zrevrangebyscore(
      key,
      now,
      startOfDay
    );

    // Parse and reverse to chronological
    const points: EquityPoint[] = rawData.map(str => {
      const parsed = JSON.parse(str);
      return { time: parsed[0], value: parsed[1] };
    }).reverse();

    return points;
  }

  /**
   * Resolves 1W, 1M, 1Y curves from the Postgres EOD snapshots.
   */
  private async getHistoricalCurve(userId: string, range: string): Promise<EquityPoint[]> {
    const now = new Date();
    let startDate = new Date();

    if (range === '1w') startDate.setDate(now.getDate() - 7);
    else if (range === '1mo') startDate.setMonth(now.getMonth() - 1);
    else if (range === '1y') startDate.setFullYear(now.getFullYear() - 1);
    else startDate = new Date(0); // 'all'

    const snapshots = await this.prisma.portfolioDailySnapshot.findMany({
      where: {
        userId,
        snapshotDate: { gte: startDate },
      },
      orderBy: { snapshotDate: 'asc' },
      select: { snapshotDate: true, balance: true, currentValue: true },
    });

    return snapshots.map(s => ({
      time: Math.floor(s.snapshotDate.getTime() / 1000),
      value: Number(s.balance) + Number(s.currentValue),
    }));
  }
}
