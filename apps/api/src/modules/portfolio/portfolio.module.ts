import { Module } from '@nestjs/common';
import { PortfolioController } from './portfolio.controller';
import { PortfolioService } from './portfolio.service';
import { SnapshotService } from './snapshot.service';
import { AnalyticsService } from './analytics.service';
import { PortfolioHistoryService } from './portfolio-history.service';
import { MarketModule } from '../market/market.module';

@Module({
  imports: [MarketModule],
  controllers: [PortfolioController],
  providers: [PortfolioService, SnapshotService, AnalyticsService, PortfolioHistoryService],
  exports: [PortfolioService, AnalyticsService],
})
export class PortfolioModule {}
