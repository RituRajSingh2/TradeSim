import { Module } from '@nestjs/common';
import { MarketRhythmService } from './market-rhythm.service';
import { SnapshotService } from './snapshot.service';
import { NotificationPreferenceService } from './notification-preference.service';
import { RetentionController } from './retention.controller';
import { MarketModule } from '../market/market.module';
import { WebsocketModule } from '../websocket/websocket.module';

@Module({
  imports: [MarketModule, WebsocketModule],
  controllers: [RetentionController],
  providers: [
    MarketRhythmService,
    SnapshotService,
    NotificationPreferenceService,
  ],
  exports: [MarketRhythmService, NotificationPreferenceService],
})
export class RetentionModule {}
