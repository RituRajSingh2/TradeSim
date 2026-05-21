import { Module } from '@nestjs/common';
import { MarketController } from './market.controller';
import { MarketService } from './market.service';
import { MarketDataProviderFactory } from './market-data.provider';
import { HistoryService } from './history.service';
import { HistorySeederService } from './history-seeder.service';

@Module({
  controllers: [MarketController],
  providers: [MarketService, MarketDataProviderFactory, HistoryService, HistorySeederService],
  exports: [MarketService, HistoryService],
})
export class MarketModule {}
