import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SnapshotService } from './snapshot.service';
import { NotificationPreferenceService } from './notification-preference.service';
import { PrismaService } from '../../database/prisma.service';
import { TradingGateway } from '../websocket/websocket.gateway';
import { WS_EVENTS } from '@tradesim/shared';
import * as crypto from 'crypto';

@Injectable()
export class MarketRhythmService {
  private readonly logger = new Logger(MarketRhythmService.name);

  constructor(
    private snapshotService: SnapshotService,
    private preferenceService: NotificationPreferenceService,
    private prisma: PrismaService,
    private wsGateway: TradingGateway,
  ) {}

  /**
   * Market Open Reminder
   * Runs at 09:15 IST (03:45 UTC) on weekdays (Monday-Friday)
   */
  @Cron('45 3 * * 1-5', {
    name: 'market_open_reminder',
    timeZone: 'UTC', // Using UTC equivalent for 09:15 IST
  })
  async handleMarketOpenReminder() {
    this.logger.log('Executing Market Open Rhythm job');

    const users = await this.prisma.user.findMany({
      where: { isActive: true },
      select: { id: true }
    });

    for (const user of users) {
      const allowed = await this.preferenceService.isAllowed(user.id, 'marketOpen');
      if (!allowed) continue;

      const notification = await this.prisma.notification.create({
        data: {
          userId: user.id,
          title: 'Market is Open',
          message: 'The Indian markets are now open for trading.',
          type: 'SYSTEM',
        }
      });

      this.wsGateway.server.to(`user:${user.id}`).emit(WS_EVENTS.NOTIFICATION, {
        id: notification.id,
        type: 'info',
        title: notification.title,
        message: notification.message,
        dismissAfterMs: 6000,
      });
    }
  }

  /**
   * End of Day Snapshot & Summary
   * Runs at 16:00 IST (10:30 UTC) on weekdays
   */
  @Cron('30 10 * * 1-5', {
    name: 'eod_snapshot',
    timeZone: 'UTC', // Using UTC equivalent for 16:00 IST
  })
  async handleEndOfDaySnapshot() {
    this.logger.log('Executing EOD Snapshot Rhythm job');

    // 1. Generate the snapshots
    await this.snapshotService.generateEndOfDaySnapshots();

    // 2. Dispatch intelligent summaries
    const users = await this.prisma.user.findMany({
      where: { isActive: true },
      select: { id: true }
    });

    for (const user of users) {
      const allowed = await this.preferenceService.isAllowed(user.id, 'eodSummary');
      if (!allowed) continue;

      const todaySnapshot = await this.prisma.portfolioSnapshot.findFirst({
        where: { userId: user.id },
        orderBy: { date: 'desc' }
      });

      if (!todaySnapshot) continue;

      // Adaptive Messaging Logic
      let title = 'Market Closed';
      let message = '';
      const pnl = Number(todaySnapshot.dailyPnlPercent);

      if (pnl > 0.5) {
        message = 'Your portfolio closed higher today. Solid performance.';
      } else if (pnl < -0.5) {
        message = 'Markets were mixed today. Your portfolio ended lower.';
      } else {
        message = 'A relatively quiet day for your portfolio.';
      }

      const notification = await this.prisma.notification.create({
        data: {
          userId: user.id,
          title,
          message,
          type: 'SYSTEM',
          metadata: { dailyPnlPercent: pnl }
        }
      });

      this.wsGateway.server.to(`user:${user.id}`).emit(WS_EVENTS.NOTIFICATION, {
        id: notification.id,
        type: 'info',
        title: notification.title,
        message: notification.message,
        dismissAfterMs: 8000,
      });
    }
  }
}
