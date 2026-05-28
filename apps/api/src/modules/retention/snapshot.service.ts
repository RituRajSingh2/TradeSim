import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PortfolioService } from '../portfolio/portfolio.service';
import { MarketService } from '../market/market.service';

@Injectable()
export class SnapshotService {
  private readonly logger = new Logger(SnapshotService.name);

  constructor(
    private prisma: PrismaService,
    private portfolioService: PortfolioService,
    private marketService: MarketService,
  ) {}

  async generateEndOfDaySnapshots(): Promise<void> {
    this.logger.log('Starting End-of-Day snapshot generation...');
    try {
      const users = await this.prisma.user.findMany({
        where: { isActive: true },
        select: { id: true }
      });

      let successCount = 0;
      let failCount = 0;
      const today = new Date();
      // Normalize to midnight UTC for date matching
      today.setUTCHours(0, 0, 0, 0);

      // Simple batching to prevent event-loop blocking on thousands of users
      const BATCH_SIZE = 50;
      for (let i = 0; i < users.length; i += BATCH_SIZE) {
        const batch = users.slice(i, i + BATCH_SIZE);
        
        await Promise.allSettled(
          batch.map(async (user: { id: string }) => {
            try {
              await this.generateSnapshotForUser(user.id, today);
              successCount++;
            } catch (error) {
              this.logger.error(`Failed to generate snapshot for user ${user.id}:`, error);
              failCount++;
            }
          })
        );
      }

      this.logger.log(`EOD Snapshots complete. Success: ${successCount}, Failed: ${failCount}`);
    } catch (error) {
      this.logger.error('Failed to generate EOD snapshots', error);
    }
  }

  private async generateSnapshotForUser(userId: string, date: Date): Promise<void> {
    // 1. Get current portfolio state (relies on real-time market data or last close)
    const summary = await this.portfolioService.getPortfolio(userId);

    // 2. Upsert snapshot for today
    await this.prisma.portfolioSnapshot.upsert({
      where: {
        userId_date: {
          userId,
          date,
        },
      },
      update: {
        totalValue: summary.balance + summary.currentValue,
        dailyPnl: summary.dayPnl,
        dailyPnlPercent: summary.dayPnlPercent,
      },
      create: {
        userId,
        date,
        totalValue: summary.balance + summary.currentValue,
        dailyPnl: summary.dayPnl,
        dailyPnlPercent: summary.dayPnlPercent,
      },
    });
  }

  /**
   * Retrieves the latest snapshot for a user before today.
   */
  async getPreviousSnapshot(userId: string): Promise<{ totalValue: number, date: Date } | null> {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const snapshot = await this.prisma.portfolioSnapshot.findFirst({
      where: {
        userId,
        date: {
          lt: today
        }
      },
      orderBy: {
        date: 'desc'
      }
    });

    if (!snapshot) return null;
    return {
      totalValue: Number(snapshot.totalValue),
      date: snapshot.date
    };
  }
}
