import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PortfolioService } from './portfolio.service';
import { AnalyticsService } from './analytics.service';
import { PortfolioHistoryService } from './portfolio-history.service';
import { JwtAuthGuard, type JwtPayload } from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('portfolio')
@UseGuards(JwtAuthGuard)
export class PortfolioController {
  constructor(
    private readonly portfolioService: PortfolioService,
    private readonly analyticsService: AnalyticsService,
    private readonly historyService: PortfolioHistoryService,
  ) {}

  /**
   * GET /api/portfolio
   * Returns full portfolio with live-enriched holdings and P&L.
   */
  @Get()
  async getPortfolio(@CurrentUser() user: JwtPayload) {
    return this.portfolioService.getPortfolio(user.sub);
  }

  /**
   * GET /api/portfolio/holdings
   * Returns only the holdings with live P&L (no portfolio summary).
   */
  @Get('holdings')
  async getHoldings(@CurrentUser() user: JwtPayload) {
    // Get portfolio ID first
    const portfolio = await this.portfolioService.getPortfolio(user.sub);
    return portfolio.holdings;
  }

  /**
   * GET /api/portfolio/transactions?page=1&pageSize=20&category=BUY_ORDER
   * Returns paginated ledger entries.
   */
  @Get('transactions')
  async getTransactions(
    @CurrentUser() user: JwtPayload,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('category') category?: string,
  ) {
    return this.portfolioService.getTransactions(
      user.sub,
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 20,
      category,
    );
  }
  /**
   * GET /api/portfolio/analytics
   * Returns deep trading performance metrics (Win Rate, P&L, Allocation).
   */
  @Get('analytics')
  async getAnalytics(@CurrentUser() user: JwtPayload) {
    return this.analyticsService.getPerformanceMetrics(user.sub);
  }

  /**
   * GET /api/portfolio/history?range=1d|1w|1mo|1y|all
   * Returns equity curve array [time, value].
   */
  @Get('history')
  async getHistory(
    @CurrentUser() user: JwtPayload,
    @Query('range') range?: string,
  ) {
    const validRanges = ['1d', '1w', '1mo', '1y', 'all'];
    const timeRange = range ? range.toLowerCase() : '1mo';
    
    if (!validRanges.includes(timeRange)) {
      throw new Error(`Invalid range. Must be one of: ${validRanges.join(', ')}`);
    }

    const points = await this.historyService.getEquityCurve(user.sub, timeRange);
    return { data: points };
  }
}
