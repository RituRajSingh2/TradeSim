import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AlertsService } from './alerts.service';
import { PrismaService } from '../../database/prisma.service';
import { TradingGateway } from '../websocket/websocket.gateway';
import { WS_EVENTS } from '@tradesim/shared';
import { AlertCondition, AlertStatus } from '@prisma/client';
import { MarketService } from '../market/market.service';

export interface PriceTickEvent {
  symbol: string;
  ltp: number;
  isMock?: boolean;
  staleness?: string;
}

@Injectable()
export class AlertEvaluationService implements OnModuleInit {
  private readonly logger = new Logger(AlertEvaluationService.name);

  // In-memory cache for beta: symbol -> alerts
  private activeAlerts = new Map<string, any[]>();

  constructor(
    private readonly alertsService: AlertsService,
    private readonly prisma: PrismaService,
    private readonly wsGateway: TradingGateway,
    private readonly marketService: MarketService,
  ) {}

  async onModuleInit() {
    await this.alertsService.syncActiveSubscriptions();
    await this.reloadCache();
  }

  private async reloadCache() {
    const alerts = await this.prisma.priceAlert.findMany({
      where: { status: 'ACTIVE' },
    });

    this.activeAlerts.clear();
    for (const alert of alerts) {
      if (!this.activeAlerts.has(alert.symbol)) {
        this.activeAlerts.set(alert.symbol, []);
      }
      this.activeAlerts.get(alert.symbol)!.push(alert);
    }
  }

  /**
   * Refreshes the cache for a specific symbol (e.g. when a new alert is created)
   */
  async refreshSymbol(symbol: string) {
    const alerts = await this.alertsService.getActiveAlertsForSymbol(symbol);
    this.activeAlerts.set(symbol, alerts);
  }

  @OnEvent('market.price.tick', { async: true })
  async handlePriceTick(event: PriceTickEvent) {
    const { symbol, ltp, isMock, staleness } = event;

    // MARKET INTEGRITY: Do not trigger on mock/stale feeds or closed market.
    if (isMock) return;
    if (staleness === 'STALE' || staleness === 'DELAYED') return;
    
    // (Optional) add market status check here if marketService exposes it
    const market = await this.marketService.getMarketStatus();
    if (!market.isOpen) return;

    const alerts = this.activeAlerts.get(symbol);
    if (!alerts || alerts.length === 0) return;

    const triggeredAlerts = [];
    const remainingAlerts = [];

    for (const alert of alerts) {
      let isTriggered = false;
      const target = Number(alert.targetPrice);

      if (alert.condition === AlertCondition.ABOVE && ltp >= target) {
        isTriggered = true;
      } else if (alert.condition === AlertCondition.BELOW && ltp <= target) {
        isTriggered = true;
      }

      if (isTriggered) {
        triggeredAlerts.push(alert);
      } else {
        remainingAlerts.push(alert);
      }
    }

    if (triggeredAlerts.length > 0) {
      // Update cache instantly to prevent spam
      this.activeAlerts.set(symbol, remainingAlerts);
      
      // Process side effects (DB updates & notifications)
      for (const alert of triggeredAlerts) {
        this.processTriggeredAlert(alert, ltp).catch((err) => {
          this.logger.error(`Failed to process alert ${alert.id}: ${err.message}`);
        });
      }
    }
  }

  private async processTriggeredAlert(alert: any, currentPrice: number) {
    // 1. Mark alert as triggered
    await this.alertsService.markAsTriggered(alert.id);

    const conditionText = alert.condition === 'ABOVE' ? 'rose above' : 'fell below';
    const message = `${alert.symbol} ${conditionText} ₹${Number(alert.targetPrice).toFixed(2)} (Current: ₹${currentPrice.toFixed(2)})`;

    // 2. Create Notification
    const notification = await this.prisma.notification.create({
      data: {
        userId: alert.userId,
        title: 'Price Alert',
        message: message,
        type: 'ALERT',
        metadata: { symbol: alert.symbol, price: currentPrice, alertId: alert.id },
      },
    });

    // 3. Emit via WebSockets
    this.wsGateway.server.to(`user:${alert.userId}`).emit(WS_EVENTS.NOTIFICATION, {
      id: notification.id,
      type: 'info',
      title: notification.title,
      message: notification.message,
      dismissAfterMs: 8000,
    });

    this.logger.debug(`Alert triggered for ${alert.userId} on ${alert.symbol} at ${currentPrice}`);
  }
}
