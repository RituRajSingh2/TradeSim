import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminMetricsService } from './admin-metrics.service';
import { WebsocketModule } from '../websocket/websocket.module';

@Module({
  imports: [WebsocketModule],
  controllers: [AdminController],
  providers: [AdminMetricsService],
})
export class AdminModule {}
