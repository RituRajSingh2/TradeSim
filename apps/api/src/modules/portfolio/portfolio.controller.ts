import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PortfolioService } from './portfolio.service';
import { JwtAuthGuard, type JwtPayload } from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('portfolio')
@UseGuards(JwtAuthGuard)
export class PortfolioController {
  constructor(private readonly portfolioService: PortfolioService) {}

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
}
