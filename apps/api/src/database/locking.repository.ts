import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { Prisma } from '@prisma/client';

/**
 * Repository for pessimistic locking operations.
 *
 * Prisma doesn't natively support SELECT FOR UPDATE,
 * so we use $queryRaw for the lock and interactive transactions
 * for the subsequent mutations.
 */
@Injectable()
export class LockingRepository {
  private readonly logger = new Logger(LockingRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Acquire a pessimistic lock on a portfolio row.
   * Must be called inside a Prisma interactive transaction.
   *
   * Usage:
   * ```ts
   * await prisma.$transaction(async (tx) => {
   *   const portfolio = await lockingRepo.lockPortfolio(tx, userId);
   *   // portfolio is locked — safe to mutate balance
   * });
   * ```
   */
  async lockPortfolio(
    tx: Prisma.TransactionClient,
    userId: string,
  ): Promise<{
    id: string;
    userId: string;
    balance: number;
    investedValue: number;
    version: number;
  }> {
    const results = await tx.$queryRaw<
      Array<{
        id: string;
        user_id: string;
        balance: string;
        invested_value: string;
        version: number;
      }>
    >`
      SELECT id, user_id, balance::text, invested_value::text, version
      FROM portfolios
      WHERE user_id = ${userId}
      FOR UPDATE
    `;

    if (results.length === 0) {
      throw new Error(`Portfolio not found for user ${userId}`);
    }

    const row = results[0];
    return {
      id: row.id,
      userId: row.user_id,
      balance: parseFloat(row.balance),
      investedValue: parseFloat(row.invested_value),
      version: row.version,
    };
  }

  /**
   * Optimistic lock update for portfolio values.
   * Returns true if update succeeded, false if version mismatch (retry needed).
   *
   * Used by the WebSocket price-tick handler to update portfolio
   * currentValue/pnl without holding a pessimistic lock.
   */
  async optimisticUpdatePortfolioValues(
    portfolioId: string,
    expectedVersion: number,
    data: {
      currentValue: number;
      totalPnl: number;
      totalPnlPercent: number;
      dayPnl: number;
      dayPnlPercent: number;
      investedValue: number;
    },
  ): Promise<boolean> {
    try {
      const result = await this.prisma.portfolio.updateMany({
        where: {
          id: portfolioId,
          version: expectedVersion,
        },
        data: {
          ...data,
          version: expectedVersion + 1,
        },
      });

      return result.count > 0;
    } catch (error) {
      this.logger.warn(
        `Optimistic lock failed for portfolio ${portfolioId} at version ${expectedVersion}`,
      );
      return false;
    }
  }
}
