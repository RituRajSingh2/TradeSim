import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { MarketModule } from '../market/market.module';
import { WebsocketModule } from '../websocket/websocket.module';

// HealthModule imports MarketModule (for ProviderManager) and WebsocketModule
// (for TradingGateway) so the readiness check can query their state without
// circular dependencies — both modules export their primary services.
@Module({
  imports: [MarketModule, WebsocketModule],
  controllers: [HealthController],
})
export class HealthModule {}
