import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard, type JwtPayload } from '../../common/guards/auth.guard';
import { PrismaService } from '../../database/prisma.service';

@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('summary')
  async getSummary(@Request() req: any) {
    const userId = req.user.id;
    
    // Fetch precomputed summary
    let summary = await this.prisma.userAnalyticsSummary.findUnique({
      where: { userId }
    });

    if (!summary) {
      // Empty state
      summary = {
        userId,
        analyticsVersion: 1,
        totalTrades: 0,
        winningTrades: 0,
        realizedPnl: 0 as any,
        bestTradeSymbol: null,
        bestTradePnl: null,
        worstTradeSymbol: null,
        worstTradePnl: null,
        totalHoldingDuration: 0,
        allocationBreakdown: {},
        lastUpdated: new Date()
      };
    }

    // Fetch real-time unrealized PnL from portfolio
    const portfolio = await this.prisma.portfolio.findUnique({
      where: { userId }
    });

    const winRate = summary.totalTrades > 0 ? (summary.winningTrades / summary.totalTrades) * 100 : 0;
    const avgDuration = summary.totalTrades > 0 ? (summary.totalHoldingDuration / summary.totalTrades) : 0;

    return {
      success: true,
      data: {
        summary: {
          ...summary,
          winRate,
          averageHoldingDuration: avgDuration
        },
        unrealizedPnl: portfolio ? Number(portfolio.totalPnl) - Number(summary.realizedPnl) : 0,
        totalPortfolioValue: portfolio ? Number(portfolio.currentValue) : 0,
      }
    };
  }

  @Get('trades')
  async getTradeReviews(@Request() req: any, @Query('page') page: string = '1', @Query('limit') limit: string = '20') {
    const userId = req.user.id;
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const [items, total] = await Promise.all([
      this.prisma.tradeReview.findMany({
        where: { userId },
        orderBy: { closedAt: 'desc' },
        skip,
        take: limitNum,
      }),
      this.prisma.tradeReview.count({ where: { userId } }),
    ]);

    return {
      success: true,
      data: {
        items,
        meta: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum),
        }
      }
    };
  }
}
