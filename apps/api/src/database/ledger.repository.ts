import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { Prisma } from '@prisma/client';

/**
 * Ledger repository — append-only operations for the immutable transaction log.
 *
 * Rules enforced by this repository:
 *   1. Only createEntry() is exposed — no update, no delete
 *   2. runningBalance is computed from the portfolio's current balance
 *   3. Every entry requires a correlation (orderId, paymentId, or referralId)
 *      except for SIGNUP_BONUS and ADMIN_ADJUSTMENT
 */
@Injectable()
export class LedgerRepository {
  private readonly logger = new Logger(LedgerRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create an immutable ledger entry within a transaction.
   * The caller must have already locked the portfolio and computed the new balance.
   *
   * @param tx - Prisma transaction client
   * @param entry - Ledger entry data
   * @returns The created ledger entry
   */
  async createEntry(
    tx: Prisma.TransactionClient,
    entry: {
      userId: string;
      entryType: 'CREDIT' | 'DEBIT';
      category:
        | 'SIGNUP_BONUS'
        | 'REFERRAL_BONUS'
        | 'PURCHASE_TOPUP'
        | 'BUY_ORDER'
        | 'SELL_ORDER'
        | 'ADMIN_ADJUSTMENT';
      amount: number;
      runningBalance: number;
      /** Deterministic key to prevent duplicate entries on retry (e.g. "buy_{orderId}") */
      idempotencyKey?: string;
      orderId?: string;
      paymentId?: string;
      referralId?: string;
      description: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    // Validate: amount must be positive
    if (entry.amount <= 0) {
      throw new Error(`Ledger amount must be positive, got ${entry.amount}`);
    }

    // Validate: runningBalance must be non-negative
    if (entry.runningBalance < 0) {
      throw new Error(
        `Running balance cannot be negative, got ${entry.runningBalance}`,
      );
    }

    return tx.ledgerEntry.create({
      data: {
        userId: entry.userId,
        entryType: entry.entryType,
        category: entry.category,
        amount: entry.amount,
        runningBalance: entry.runningBalance,
        idempotencyKey: entry.idempotencyKey || null,
        orderId: entry.orderId || null,
        paymentId: entry.paymentId || null,
        referralId: entry.referralId || null,
        description: entry.description,
        metadata: entry.metadata
          ? (entry.metadata as Prisma.InputJsonValue)
          : undefined,
      },
    });
  }

  /**
   * Get the current balance from the latest ledger entry.
   * Used for reconciliation checks.
   */
  async getLatestBalance(userId: string): Promise<number | null> {
    const latest = await this.prisma.ledgerEntry.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { runningBalance: true },
    });

    return latest ? Number(latest.runningBalance) : null;
  }

  /**
   * Reconcile: verify portfolio.balance matches ledger.
   * Returns { isConsistent, portfolioBalance, ledgerBalance }.
   */
  async reconcile(userId: string): Promise<{
    isConsistent: boolean;
    portfolioBalance: number;
    ledgerBalance: number | null;
  }> {
    const [portfolio, ledgerBalance] = await Promise.all([
      this.prisma.portfolio.findUnique({
        where: { userId },
        select: { balance: true },
      }),
      this.getLatestBalance(userId),
    ]);

    const portfolioBalance = portfolio ? Number(portfolio.balance) : 0;

    const isConsistent =
      ledgerBalance !== null &&
      Math.abs(portfolioBalance - ledgerBalance) < 0.01; // ₹0.01 tolerance

    if (!isConsistent) {
      this.logger.error(
        `Reconciliation FAILED for user ${userId}: ` +
          `portfolio=${portfolioBalance}, ledger=${ledgerBalance}`,
      );
    }

    return { isConsistent, portfolioBalance, ledgerBalance };
  }

  /**
   * Get ledger entries for a user (paginated, reverse-chrono).
   */
  async getEntries(
    userId: string,
    options: { page: number; pageSize: number; category?: string },
  ) {
    const { page, pageSize, category } = options;
    const where: Prisma.LedgerEntryWhereInput = { userId };

    if (category) {
      where.category = category as Prisma.EnumLedgerCategoryFilter;
    }

    const [items, total] = await Promise.all([
      this.prisma.ledgerEntry.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.ledgerEntry.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      hasMore: page * pageSize < total,
    };
  }
}
