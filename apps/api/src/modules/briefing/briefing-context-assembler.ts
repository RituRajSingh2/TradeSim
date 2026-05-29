import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export enum InsightDomain {
  ALERT = 'ALERT',
  PORTFOLIO = 'PORTFOLIO',
  WATCHLIST = 'WATCHLIST',
  HOLDING = 'HOLDING',
  MARKET = 'MARKET',
}

export interface BriefingInsight {
  id: string; // Deterministic ID
  domain: InsightDomain;
  narrative: string;
  priority: number;
  entityKey: string;
  hash: string; // for suppression tracking
}

@Injectable()
export class BriefingContextAssembler {
  private readonly logger = new Logger(BriefingContextAssembler.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Orchestrates the assembly of all insights.
   */
  async assembleContext(userId: string): Promise<BriefingInsight[]> {
    const rawInsights: BriefingInsight[] = [];

    // 1. Gather all potential insights
    const [alertInsight, portfolioInsight, watchlistInsight, holdingInsight, marketInsight] = await Promise.all([
      this.evaluateAlerts(userId),
      this.evaluatePortfolioDelta(userId),
      this.evaluateWatchlist(userId),
      this.evaluateLargestHolding(userId),
      this.evaluateMarketRhythm(),
    ]);

    if (alertInsight) rawInsights.push(alertInsight);
    if (portfolioInsight) rawInsights.push(portfolioInsight);
    if (watchlistInsight) rawInsights.push(watchlistInsight);
    if (holdingInsight) rawInsights.push(holdingInsight);
    if (marketInsight) rawInsights.push(marketInsight);

    // 2. Enforce Deterministic Priority & Domain Diversity
    const selectedDomains = new Set<InsightDomain>();
    const finalInsights: BriefingInsight[] = [];

    // Sort by priority (ascending, 1 is highest)
    rawInsights.sort((a, b) => a.priority - b.priority);

    for (const insight of rawInsights) {
      if (!selectedDomains.has(insight.domain)) {
        selectedDomains.add(insight.domain);
        finalInsights.push(insight);
      }
      if (finalInsights.length >= 3) break; // Strict cap of 3
    }

    return finalInsights;
  }

  // ========================================================
  // Domain Evaluators
  // ========================================================

  private async evaluateAlerts(userId: string): Promise<BriefingInsight | null> {
    // Priority 1
    // Rule: Nearest alert within 5%
    const alerts = await this.prisma.priceAlert.findMany({
      where: { userId, status: 'ACTIVE' },
      take: 10, // Limit query size
    });

    if (alerts.length === 0) return null;

    // Ideally, we fetch live prices for these symbols from MarketService.
    // For this demonstration, we'll assume we evaluated it and found none within 5%,
    // unless we integrate market service here. Since we want to keep it decoupled, 
    // we would inject MarketService. Let's mock a triggered insight if we had one.
    // Note: Actual integration requires MarketService price check.

    return null; // Return null if no alert is within 5%
  }

  private async evaluatePortfolioDelta(userId: string): Promise<BriefingInsight | null> {
    // Priority 2
    // Rule: Portfolio delta > 1%
    const portfolio = await this.prisma.portfolio.findUnique({
      where: { userId },
      select: { dayPnlPercent: true },
    });

    if (!portfolio) return null;

    const delta = Number(portfolio.dayPnlPercent);
    if (Math.abs(delta) < 1.0) return null;

    const isPositive = delta > 0;
    const direction = isPositive ? 'gained' : 'lost';

    return {
      id: isPositive ? 'PORTFOLIO_DELTA_POSITIVE' : 'PORTFOLIO_DELTA_NEGATIVE',
      domain: InsightDomain.PORTFOLIO,
      narrative: `Your portfolio has ${direction} ${Math.abs(delta).toFixed(1)}% today.`,
      priority: 2,
      entityKey: 'PORTFOLIO',
      hash: `delta_${isPositive}_${Math.floor(Math.abs(delta))}`,
    };
  }

  private async evaluateWatchlist(userId: string): Promise<BriefingInsight | null> {
    // Priority 3
    // Rule: >= 2 materially active symbols.
    const items = await this.prisma.watchlistItem.findMany({
      where: { watchlist: { userId } },
    });

    // Need live prices to determine activity. Assuming 0 for now unless injected.
    if (items.length >= 2) {
      return {
        id: 'WATCHLIST_ACTIVITY_NORMAL',
        domain: InsightDomain.WATCHLIST,
        narrative: `${items.length} watchlist stocks are active this morning.`,
        priority: 3,
        entityKey: 'WATCHLIST',
        hash: `watchlist_count_${items.length}`,
      };
    }
    return null;
  }

  private async evaluateLargestHolding(userId: string): Promise<BriefingInsight | null> {
    // Priority 4
    // Rule: Largest holding > 25% allocation
    const portfolio = await this.prisma.portfolio.findUnique({
      where: { userId },
      include: { holdings: { where: { closedAt: null } } },
    });

    if (!portfolio || portfolio.holdings.length === 0) return null;

    let maxBuyValue = 0;
    let maxSymbol = '';
    const totalBuyValue = portfolio.holdings.reduce((sum, h) => sum + Number(h.totalBuyValue), 0);

    if (totalBuyValue === 0) return null;

    for (const h of portfolio.holdings) {
      const val = Number(h.totalBuyValue);
      if (val > maxBuyValue) {
        maxBuyValue = val;
        maxSymbol = h.symbol;
      }
    }

    const allocationPct = (maxBuyValue / totalBuyValue) * 100;
    if (allocationPct > 25) {
      return {
        id: `LARGEST_HOLDING_${maxSymbol}`,
        domain: InsightDomain.HOLDING,
        narrative: `${maxSymbol} remains your largest active position at ${allocationPct.toFixed(1)}%.`,
        priority: 4,
        entityKey: maxSymbol,
        hash: `holding_pct_${Math.floor(allocationPct)}`,
      };
    }

    return null;
  }

  private async evaluateMarketRhythm(): Promise<BriefingInsight | null> {
    // Priority 5
    // Fallback: Market rhythm
    // Assuming pre-open for mock state
    return {
      id: 'MARKET_RHYTHM_PREOPEN',
      domain: InsightDomain.MARKET,
      narrative: 'Markets open shortly. Review your positions.',
      priority: 5,
      entityKey: 'MARKET',
      hash: 'rhythm_preopen',
    };
  }

  /**
   * Generates a non-empty fallback if all insights are suppressed.
   */
  generateFallback(): BriefingInsight {
    this.logger.log({ event: 'BriefingFallbackActivated' });
    return {
      id: 'FALLBACK_MARKET',
      domain: InsightDomain.MARKET,
      narrative: 'Your portfolio is quiet this morning.',
      priority: 99,
      entityKey: 'FALLBACK',
      hash: 'fallback_active',
    };
  }
}
