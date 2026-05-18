import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma.service';
import { LedgerRepository } from '../../database/ledger.repository';
import { PortfolioService } from './portfolio.service';

// ============================================================
// Snapshot Service — EOD Portfolio Snapshots for Leaderboard
//
// Runs at 3:45 PM IST (Mon–Fri) — 15 minutes after market close.
// Creates a PortfolioDailySnapshot for each active user with holdings.
// Also runs ledger reconciliation.
// ============================================================

@Injectable()
export class SnapshotService {
  private readonly logger = new Logger(SnapshotService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerRepository,
    private readonly portfolioService: PortfolioService,
  ) {}

  /**
   * EOD snapshot CRON — 3:45 PM IST = 10:15 AM UTC (Mon–Fri).
   * IST is UTC+5:30, so 15:45 IST = 10:15 UTC.
   */
  @Cron('15 10 * * 1-5', {
    name: 'eod-portfolio-snapshot',
    timeZone: 'UTC',
  })
  async generateDailySnapshots() {
    this.logger.log('📸 Starting EOD portfolio snapshot generation...');
    const startTime = Date.now();

    try {
      // Get all active users with portfolios
      const portfolios = await this.prisma.portfolio.findMany({
        where: {
          user: { deletedAt: null, isActive: true },
        },
        select: { userId: true, id: true },
      });

      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const snapshotDate = today;

      let processed = 0;
      let skipped = 0;
      let errors = 0;

      for (const portfolio of portfolios) {
        try {
          // Check if snapshot already exists (idempotent)
          const existing = await this.prisma.portfolioDailySnapshot.findUnique({
            where: {
              userId_snapshotDate: {
                userId: portfolio.userId,
                snapshotDate,
              },
            },
          });

          if (existing) {
            skipped++;
            continue;
          }

          // Get enriched portfolio data
          const fullPortfolio = await this.portfolioService.getPortfolio(
            portfolio.userId,
          );

          // Create snapshot
          await this.prisma.portfolioDailySnapshot.create({
            data: {
              userId: portfolio.userId,
              snapshotDate,
              balance: fullPortfolio.balance,
              investedValue: fullPortfolio.investedValue,
              currentValue: fullPortfolio.currentValue,
              dayPnl: fullPortfolio.dayPnl,
              dayPnlPercent: fullPortfolio.dayPnlPercent,
              totalPnl: fullPortfolio.totalPnl,
              totalPnlPercent: fullPortfolio.totalPnlPercent,
              holdingsSnapshot: JSON.parse(JSON.stringify(fullPortfolio.holdings)),
            },
          });

          // Run reconciliation check
          const reconciliation = await this.ledger.reconcile(portfolio.userId);
          if (!reconciliation.isConsistent) {
            this.logger.error(
              `Reconciliation FAILED for user ${portfolio.userId}`,
            );
          }

          // Update lastReconciledAt
          await this.prisma.portfolio.update({
            where: { id: portfolio.id },
            data: { lastReconciledAt: new Date() },
          });

          processed++;
        } catch (error) {
          errors++;
          this.logger.error(
            `Snapshot failed for user ${portfolio.userId}: ${error}`,
          );
        }
      }

      const elapsed = Date.now() - startTime;
      this.logger.log(
        `📸 EOD snapshots complete: ${processed} created, ${skipped} skipped, ${errors} errors (${elapsed}ms)`,
      );
    } catch (error) {
      this.logger.error(`EOD snapshot job failed: ${error}`);
    }
  }
}
