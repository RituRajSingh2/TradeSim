import { Module } from '@nestjs/common';
import { TradingGateway } from './websocket.gateway';
import { SubscriptionManager } from './subscription-manager';
import { PriceBroadcaster } from './price-broadcaster.service';
import { MarketModule } from '../market/market.module';

@Module({
  imports: [MarketModule],
  providers: [TradingGateway, SubscriptionManager, PriceBroadcaster],
  exports: [TradingGateway, SubscriptionManager],
})
export class WebsocketModule {}
