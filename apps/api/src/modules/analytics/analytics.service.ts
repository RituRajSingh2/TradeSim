import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Records a completed trade (or partial exit) and incrementally updates the user's analytics summary
   * within a single, atomic database transaction.
   */
  async recordTradeExit(
    tx: Prisma.TransactionClient,
    params: {
      userId: string;
      symbolId: string;
      symbol: string;
      entryPrice: number;
      exitPrice: number;
      quantity: number;
      realizedPnl: number;
      holdingDurationMinutes: number;
      openedAt: Date;
      closedAt: Date;
      idempotencyKey: string;
    }
  ) {
    const {
      userId,
      symbolId,
      symbol,
      entryPrice,
      exitPrice,
      quantity,
      realizedPnl,
      holdingDurationMinutes,
      openedAt,
      closedAt,
      idempotencyKey,
    } = params;

    const isWin = realizedPnl > 0;

    try {
        // 1. Create the immutable TradeReview (Idempotency check)
        await tx.tradeReview.create({
          data: {
            idempotencyKey,
            userId,
            symbolId,
            symbol,
            entryPrice,
            exitPrice,
            quantity,
            realizedPnl,
            holdingDuration: holdingDurationMinutes,
            openedAt,
            closedAt,
          },
        });

        // 2. Fetch current summary (if exists) to check best/worst thresholds
        let summary = await tx.userAnalyticsSummary.findUnique({
          where: { userId },
        });

        if (!summary) {
          summary = await tx.userAnalyticsSummary.create({
            data: {
              userId,
              allocationBreakdown: {},
            },
          });
        }

        // 3. Determine if we beat the best/worst trade
        const currentBest = summary.bestTradePnl ? Number(summary.bestTradePnl) : -Infinity;
        const currentWorst = summary.worstTradePnl ? Number(summary.worstTradePnl) : Infinity;

        const isNewBest = realizedPnl > currentBest;
        const isNewWorst = realizedPnl < currentWorst;

        // 4. Atomically update the summary using increment operators
        await tx.userAnalyticsSummary.update({
          where: { userId },
          data: {
            totalTrades: { increment: 1 },
            winningTrades: { increment: isWin ? 1 : 0 },
            realizedPnl: { increment: realizedPnl },
            totalHoldingDuration: { increment: holdingDurationMinutes },
            lastUpdated: new Date(),
            ...(isNewBest && {
              bestTradeSymbol: symbol,
              bestTradePnl: realizedPnl,
            }),
            ...(isNewWorst && {
              worstTradeSymbol: symbol,
              worstTradePnl: realizedPnl,
            }),
          },
        });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          this.logger.warn(`Idempotent retry blocked for trade exit: ${idempotencyKey}`);
          return;
        }
      }
      this.logger.error(`Failed to record trade exit for ${userId}:`, error.stack);
      throw error;
    }
  }
}
