import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../redis/redis.service';

const ANALYTICS_PREFIX = 'portfolio:analytics:';
const CACHE_TTL = 3600; // 1 hour (but mostly driven by portfolio version)

export interface PerformanceMetrics {
  winRate: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  realizedPnl: number;
  unrealizedPnl: number;
  bestTrade: { symbol: string; pnl: number; percent: number } | null;
  worstTrade: { symbol: string; pnl: number; percent: number } | null;
  avgHoldingDurationMs: number;
  allocation: Record<string, number>; // symbol -> percent
  portfolioVersion: number;
  generatedAt: number;
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Get cached or compute fresh analytics based on portfolio versioning.
   */
  async getPerformanceMetrics(userId: string): Promise<PerformanceMetrics> {
    const cacheKey = `${ANALYTICS_PREFIX}${userId}`;

    // 1. Fetch current portfolio to check version & unrealized PNL
    const portfolio = await this.prisma.portfolio.findUnique({
      where: { userId },
      include: {
        holdings: {
          include: { marketSymbol: true },
        },
      },
    });

    if (!portfolio) {
      throw new Error(`Portfolio not found for user ${userId}`);
    }

    // 2. Check Cache
    const cached = await this.redis.getJson<PerformanceMetrics>(cacheKey);
    if (cached && cached.portfolioVersion === portfolio.version) {
      // Version matches, but we MUST inject the LIVE unrealized PNL & allocation
      // because prices tick up and down without bumping the portfolio ledger version.
      // Realized metrics are safely cached.
      return this.enrichLiveMetrics(cached, portfolio);
    }

    // 3. Cache Miss or Version Mismatch -> Compute Realized Metrics from DB
    this.logger.debug(`Computing fresh analytics for user ${userId} (version ${portfolio.version})`);
    const metrics = await this.computeMetrics(userId, portfolio);

    // 4. Cache the result
    await this.redis.setJson(cacheKey, metrics, CACHE_TTL);

    return metrics;
  }

  /**
   * Perform heavy DB computations for realized metrics (Win Rate, Best/Worst trades).
   */
  private async computeMetrics(userId: string, portfolio: any): Promise<PerformanceMetrics> {
    // Get all closed holdings for the user
    const closedHoldings = await this.prisma.holding.findMany({
      where: {
        portfolioId: portfolio.id,
        closedAt: { not: null },
        realizedPnl: { not: null },
      },
    });

    let winningTrades = 0;
    let losingTrades = 0;
    let totalRealizedPnl = 0;
    let totalDurationMs = 0;
    let bestTrade: PerformanceMetrics['bestTrade'] = null;
    let worstTrade: PerformanceMetrics['worstTrade'] = null;

    for (const holding of closedHoldings) {
      const pnl = Number(holding.realizedPnl);
      const exitValue = Number(holding.totalExitValue) || 1; // avoid /0
      const percent = (pnl / (exitValue - pnl)) * 100; // approximate roi
      
      totalRealizedPnl += pnl;
      totalDurationMs += holding.holdingDuration || 0;

      if (pnl > 0) {
        winningTrades++;
        if (!bestTrade || pnl > bestTrade.pnl) {
          bestTrade = { symbol: holding.symbol, pnl, percent };
        }
      } else if (pnl < 0) {
        losingTrades++;
        if (!worstTrade || pnl < worstTrade.pnl) {
          worstTrade = { symbol: holding.symbol, pnl, percent };
        }
      }
    }

    const totalTrades = winningTrades + losingTrades;
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
    const avgHoldingDurationMs = totalTrades > 0 ? totalDurationMs / totalTrades : 0;

    // Base cache object (only holds immutable realized stats + version)
    const baseMetrics: PerformanceMetrics = {
      winRate,
      totalTrades,
      winningTrades,
      losingTrades,
      realizedPnl: totalRealizedPnl,
      unrealizedPnl: 0, // Injected live
      bestTrade,
      worstTrade,
      avgHoldingDurationMs,
      allocation: {}, // Injected live
      portfolioVersion: portfolio.version,
      generatedAt: Date.now(),
    };

    return this.enrichLiveMetrics(baseMetrics, portfolio);
  }

  /**
   * Enriches cached realized metrics with LIVE unrealized PNL and Allocation.
   */
  private enrichLiveMetrics(metrics: PerformanceMetrics, portfolio: any): PerformanceMetrics {
    let unrealizedPnl = 0;
    let totalValue = 0;
    const allocation: Record<string, number> = {};

    // For simplicity, we use the portfolio's totalPnl as proxy if we don't have live prices here.
    // Ideally, the frontend computes live Unrealized PNL using active WebSocket ticks.
    // Here we return the last known snapshot from the portfolio row.
    unrealizedPnl = Number(portfolio.totalPnl);

    // Compute allocation based on investedValue (or current value if tracked natively)
    for (const h of portfolio.holdings) {
      if (!h.closedAt && h.quantity > 0) {
        const value = Number(h.totalBuyValue);
        totalValue += value;
        allocation[h.symbol] = (allocation[h.symbol] || 0) + value;
      }
    }

    // Convert allocation to percentages
    if (totalValue > 0) {
      for (const sym in allocation) {
        allocation[sym] = (allocation[sym] / totalValue) * 100;
      }
    }

    // Cash allocation
    const cash = Number(portfolio.balance);
    if (cash > 0 && totalValue + cash > 0) {
      allocation['CASH'] = (cash / (totalValue + cash)) * 100;
      // Adjust other allocations to include cash in the total pie
      for (const sym in allocation) {
        if (sym !== 'CASH') {
          allocation[sym] = (allocation[sym] / 100) * ((totalValue / (totalValue + cash)) * 100);
        }
      }
    }

    return {
      ...metrics,
      unrealizedPnl,
      allocation,
    };
  }

  /**
   * Expose invalidation separately if explicit invalidation is ever needed
   * (e.g. from an admin panel), but mostly driven implicitly by version bumps.
   */
  async invalidateAnalytics(userId: string) {
    await this.redis.getClient().del(`${ANALYTICS_PREFIX}${userId}`);
  }
}
