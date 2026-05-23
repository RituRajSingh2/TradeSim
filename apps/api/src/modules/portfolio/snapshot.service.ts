import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma.service';
import { LedgerRepository } from '../../database/ledger.repository';
import { PortfolioService } from './portfolio.service';
import { LeaderboardService } from '../leaderboard/leaderboard.service';
import { RedisService } from '../../redis/redis.service';
import { PlatformEvent } from '@tradesim/shared';

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
    private readonly leaderboardService: LeaderboardService,
    private readonly redisService: RedisService,
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
    this.logger.log({
      eventType: PlatformEvent.CRON_STARTED,
      message: 'Starting EOD portfolio snapshot generation...',
      metadata: { cron: 'eod-portfolio-snapshot' }
    });

    const lockToken = await this.redisService.acquireLock('cron:eod_snapshot', 3600);
    if (!lockToken) {
      this.logger.log('Snapshot job is already running on another instance. Skipping.');
      return;
    }

    const startTime = Date.now();
    let errors = 0;

    try {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const snapshotDate = today;

      let processed = 0;
      let skipped = 0;

      let lastId: string | undefined;
      const batchSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const portfolios = await this.prisma.portfolio.findMany({
          take: batchSize,
          ...(lastId && { skip: 1, cursor: { id: lastId } }),
          where: {
            user: { deletedAt: null, isActive: true },
          },
          select: { userId: true, id: true },
          orderBy: { id: 'asc' },
        });

        if (portfolios.length < batchSize) {
          hasMore = false;
        }
        if (portfolios.length > 0) {
          lastId = portfolios[portfolios.length - 1].id;
        }



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
        } catch (error: any) {
          errors++;
          this.logger.warn({
            eventType: PlatformEvent.CRON_BATCH_FAILED,
            message: `Snapshot failed for user ${portfolio.userId}`,
            metadata: { userId: portfolio.userId, error: String(error) }
          });
        }
      }

      // Explicit yield for event loop within batch loop
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

      const elapsed = Date.now() - startTime;
      this.logger.log({
        eventType: PlatformEvent.CRON_SNAPSHOT_GENERATED,
        message: `EOD snapshots complete: ${processed} created, ${skipped} skipped, ${errors} errors`,
        metadata: { processed, skipped, errors, durationMs: elapsed }
      });

      // Orchestrate leaderboard if successful
      if (errors === 0) {
        this.logger.log('📸 Snapshots cleanly finished. Triggering Leaderboard Engine...');
        // Fire and forget (it handles its own locking/errors)
        this.leaderboardService.generateRankings().catch(err => {
          this.logger.error(`Leaderboard generation failed post-snapshot: ${err}`);
        });
      } else {
        this.logger.error('📸 Snapshots had errors. Bypassing Leaderboard generation to prevent rank corruption.');
      }
    } catch (error: any) {
      this.logger.error({
        eventType: PlatformEvent.CRON_BATCH_FAILED,
        message: 'EOD snapshot job failed',
        metadata: { error: String(error) }
      });
    } finally {
      await this.redisService.releaseLock('cron:eod_snapshot', lockToken);
      this.logger.log('🔒 Released snapshot lock.');
    }
  }
}
