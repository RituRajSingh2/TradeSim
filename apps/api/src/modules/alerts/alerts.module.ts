import { Module } from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { AlertEvaluationService } from './alert-evaluation.service';
import { AlertsController } from './alerts.controller';
import { NotificationsController } from './notifications.controller';
import { WebsocketModule } from '../websocket/websocket.module';
import { MarketModule } from '../market/market.module';

@Module({
  imports: [WebsocketModule, MarketModule],
  controllers: [AlertsController, NotificationsController],
  providers: [AlertsService, AlertEvaluationService],
  exports: [AlertsService],
})
export class AlertsModule {}
