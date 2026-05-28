import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SubscriptionManager } from '../websocket/subscription-manager';
import { AlertCondition, AlertStatus } from '@prisma/client';

export const SYSTEM_ALERTS_CLIENT_ID = 'system-alerts-engine';

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptions: SubscriptionManager,
  ) {
    // Register the virtual client for system alerts
    this.subscriptions.registerClient(SYSTEM_ALERTS_CLIENT_ID);
  }

  /**
   * Sync active alerts to the SubscriptionManager on startup.
   */
  async syncActiveSubscriptions() {
    const activeAlerts = await this.prisma.priceAlert.findMany({
      where: { status: 'ACTIVE' },
      select: { symbol: true },
      distinct: ['symbol'],
    });

    for (const alert of activeAlerts) {
      this.subscriptions.subscribe(SYSTEM_ALERTS_CLIENT_ID, alert.symbol);
    }
    
    this.logger.log(`Synced ${activeAlerts.length} active alert symbols for polling.`);
  }

  async createAlert(userId: string, symbol: string, targetPrice: number, condition: AlertCondition) {
    const alert = await this.prisma.priceAlert.create({
      data: {
        userId,
        symbol,
        targetPrice,
        condition,
        status: 'ACTIVE',
      },
    });

    // Subscribe system to this symbol to ensure it gets polled
    this.subscriptions.subscribe(SYSTEM_ALERTS_CLIENT_ID, symbol);

    return alert;
  }

  async getActiveAlertsForSymbol(symbol: string) {
    return this.prisma.priceAlert.findMany({
      where: {
        symbol,
        status: 'ACTIVE',
      },
      include: {
        user: {
          select: { id: true }
        }
      }
    });
  }

  async markAsTriggered(alertId: string) {
    return this.prisma.priceAlert.update({
      where: { id: alertId },
      data: {
        status: 'TRIGGERED',
        triggeredAt: new Date(),
      },
    });
  }

  async getUserAlerts(userId: string) {
    return this.prisma.priceAlert.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
