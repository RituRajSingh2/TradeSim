import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class ReconciliationService {
  private readonly logger = new Logger(ReconciliationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Runs nightly at 11:30 PM (IST approx) to:
   * 1. Detect and repair analytics drift by comparing summaries with TradeReview truths.
   * 2. Log drift events if repairs were made.
   * 3. Capture the daily AnalyticsSnapshot.
   */
  @Cron(CronExpression.EVERY_DAY_AT_11PM)
  async runNightlyReconciliation() {
    this.logger.log('Starting nightly analytics reconciliation job...');
    
    try {
      const users = await this.prisma.user.findMany({
        select: { id: true }
      });

      for (const user of users) {
        await this.reconcileUser(user.id);
      }
      
      this.logger.log('Nightly analytics reconciliation complete.');
    } catch (error) {
      this.logger.error('Failed to run nightly reconciliation', error.stack);
    }
  }

  private async reconcileUser(userId: string) {
    try {
      await this.prisma.$transaction(async (tx) => {
        // 1. Compute truth from immutable TradeReview records
        const reviews = await tx.tradeReview.findMany({
          where: { userId },
        });

        // Optimization: Skip empty users completely
        if (reviews.length === 0) return;

        const truth = {
          totalTrades: reviews.length,
          winningTrades: reviews.filter(r => Number(r.realizedPnl) > 0).length,
          realizedPnl: reviews.reduce((sum, r) => sum + Number(r.realizedPnl), 0),
          totalHoldingDuration: reviews.reduce((sum, r) => sum + r.holdingDuration, 0),
          bestTradePnl: -Infinity,
          bestTradeSymbol: null as string | null,
          worstTradePnl: Infinity,
          worstTradeSymbol: null as string | null,
        };

        for (const r of reviews) {
          const pnl = Number(r.realizedPnl);
          if (pnl > truth.bestTradePnl) {
            truth.bestTradePnl = pnl;
            truth.bestTradeSymbol = r.symbol;
          }
          if (pnl < truth.worstTradePnl) {
            truth.worstTradePnl = pnl;
            truth.worstTradeSymbol = r.symbol;
          }
        }

        if (truth.bestTradePnl === -Infinity) truth.bestTradePnl = 0;
        if (truth.worstTradePnl === Infinity) truth.worstTradePnl = 0;

        // 2. Fetch current summary
        const summary = await tx.userAnalyticsSummary.findUnique({
          where: { userId }
        });

        if (summary) {
          const currentPnl = Number(summary.realizedPnl);
          
          // 3. Detect Drift
          const hasDrift = 
            summary.totalTrades !== truth.totalTrades ||
            summary.winningTrades !== truth.winningTrades ||
            Math.abs(currentPnl - truth.realizedPnl) > 0.01;

          if (hasDrift) {
            const nextVersion = summary.analyticsVersion + 1;
            
            // 4. Log Drift Event
            await tx.analyticsDriftEvent.create({
              data: {
                userId,
                mismatchType: 'AGGREGATION_DRIFT',
                repairedFields: ['totalTrades', 'winningTrades', 'realizedPnl', 'totalHoldingDuration'],
                beforeValues: {
                  totalTrades: summary.totalTrades,
                  winningTrades: summary.winningTrades,
                  realizedPnl: currentPnl,
                },
                afterValues: {
                  totalTrades: truth.totalTrades,
                  winningTrades: truth.winningTrades,
                  realizedPnl: truth.realizedPnl,
                },
                analyticsVersion: nextVersion,
              }
            });

            // 5. Repair Summary
            await tx.userAnalyticsSummary.update({
              where: { userId },
              data: {
                totalTrades: truth.totalTrades,
                winningTrades: truth.winningTrades,
                realizedPnl: truth.realizedPnl,
                totalHoldingDuration: truth.totalHoldingDuration,
                bestTradeSymbol: truth.bestTradeSymbol,
                bestTradePnl: truth.bestTradePnl === 0 ? null : truth.bestTradePnl,
                worstTradeSymbol: truth.worstTradeSymbol,
                worstTradePnl: truth.worstTradePnl === 0 ? null : truth.worstTradePnl,
                analyticsVersion: nextVersion,
                lastUpdated: new Date()
              }
            });
            this.logger.log(`Repaired drift for user ${userId} to version ${nextVersion}`);
          }
        }

        // 6. Capture Daily Snapshot
        const portfolio = await tx.portfolio.findUnique({
          where: { userId }
        });
        
        if (portfolio) {
          const winRate = truth.totalTrades > 0 ? (truth.winningTrades / truth.totalTrades) * 100 : 0;
          
          await tx.analyticsSnapshot.upsert({
            where: {
              userId_date: {
                userId,
                date: new Date(new Date().setUTCHours(0,0,0,0))
              }
            },
            update: {
              realizedPnl: truth.realizedPnl,
              totalTrades: truth.totalTrades,
              winRate: winRate,
              portfolioValue: portfolio.currentValue,
            },
            create: {
              userId,
              date: new Date(new Date().setUTCHours(0,0,0,0)),
              realizedPnl: truth.realizedPnl,
              totalTrades: truth.totalTrades,
              winRate: winRate,
              portfolioValue: portfolio.currentValue,
            }
          });
        }
      });
    } catch (e) {
      this.logger.error(`Failed reconciliation for user ${userId}:`, e.stack);
    }
  }
}
