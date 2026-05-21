import { Module } from '@nestjs/common';
import { PortfolioController } from './portfolio.controller';
import { PortfolioService } from './portfolio.service';
import { SnapshotService } from './snapshot.service';
import { AnalyticsService } from './analytics.service';
import { PortfolioHistoryService } from './portfolio-history.service';
import { MarketModule } from '../market/market.module';
import { LeaderboardModule } from '../leaderboard/leaderboard.module';
import { RedisModule } from '../../redis/redis.module';

@Module({
  imports: [MarketModule, LeaderboardModule, RedisModule],
  controllers: [PortfolioController],
  providers: [PortfolioService, SnapshotService, AnalyticsService, PortfolioHistoryService],
  exports: [PortfolioService, AnalyticsService],
})
export class PortfolioModule {}
