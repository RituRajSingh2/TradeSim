import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { LedgerRepository } from '../../database/ledger.repository';
import { MarketService } from '../market/market.service';

// ============================================================
// Portfolio Service — Real-time portfolio & holdings with P&L
// ============================================================

@Injectable()
export class PortfolioService {
  private readonly logger = new Logger(PortfolioService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerRepository,
    private readonly marketService: MarketService,
  ) {}

  /**
   * Get full portfolio with live-enriched holdings.
   * Fetches current prices for all holdings and calculates P&L.
   */
  async getPortfolio(userId: string) {
    const portfolio = await this.prisma.portfolio.findUnique({
      where: { userId },
    });

    if (!portfolio) {
      throw new NotFoundException('Portfolio not found');
    }

    const holdings = await this.getEnrichedHoldings(portfolio.id);

    // Compute live portfolio values from holdings
    const totalInvested = holdings.reduce((sum, h) => sum + h.investedValue, 0);
    const totalCurrent = holdings.reduce((sum, h) => sum + h.currentValue, 0);
    const totalPnl = +(totalCurrent - totalInvested).toFixed(2);
    const totalPnlPercent = totalInvested > 0
      ? +((totalPnl / totalInvested) * 100).toFixed(2)
      : 0;
    const dayPnl = holdings.reduce((sum, h) => sum + h.dayChange, 0);
    const dayPnlPercent = totalCurrent > 0
      ? +((dayPnl / (totalCurrent - dayPnl)) * 100).toFixed(2)
      : 0;

    return {
      id: portfolio.id,
      userId: portfolio.userId,
      balance: Number(portfolio.balance),
      investedValue: +totalInvested.toFixed(2),
      currentValue: +totalCurrent.toFixed(2),
      totalPnl,
      totalPnlPercent,
      dayPnl: +dayPnl.toFixed(2),
      dayPnlPercent,
      holdings,
      createdAt: portfolio.createdAt.toISOString(),
      updatedAt: portfolio.updatedAt.toISOString(),
    };
  }

  /**
   * Get enriched holdings with live prices and P&L.
   */
  async getEnrichedHoldings(portfolioId: string) {
    const holdings = await this.prisma.holding.findMany({
      where: { portfolioId, closedAt: null, quantity: { gt: 0 } },
      orderBy: { createdAt: 'desc' },
    });

    if (holdings.length === 0) return [];

    // Batch fetch current prices
    const symbols = holdings.map((h) => h.symbol);
    const quotes = await this.marketService.getBulkQuotes(symbols);

    return holdings.map((h) => {
      const quote = quotes.get(h.symbol);
      const currentPrice = quote?.ltp || Number(h.avgBuyPrice);
      const investedValue = Number(h.totalBuyValue);
      const currentValue = +(currentPrice * h.quantity).toFixed(2);
      const pnl = +(currentValue - investedValue).toFixed(2);
      const pnlPercent = investedValue > 0
        ? +((pnl / investedValue) * 100).toFixed(2)
        : 0;

      const previousClose = quote?.previousClose || currentPrice;
      const dayChange = +((currentPrice - previousClose) * h.quantity).toFixed(2);
      const dayChangePercent = previousClose > 0
        ? +(((currentPrice - previousClose) / previousClose) * 100).toFixed(2)
        : 0;

      return {
        id: h.id,
        portfolioId: h.portfolioId,
        symbol: h.symbol,
        companyName: h.companyName,
        quantity: h.quantity,
        avgBuyPrice: Number(h.avgBuyPrice),
        currentPrice,
        investedValue,
        currentValue,
        pnl,
        pnlPercent,
        dayChange,
        dayChangePercent,
      };
    });
  }

  /**
   * Get transaction history (paginated ledger entries).
   */
  async getTransactions(
    userId: string,
    page = 1,
    pageSize = 20,
    category?: string,
  ) {
    return this.ledger.getEntries(userId, { page, pageSize, category });
  }
}
