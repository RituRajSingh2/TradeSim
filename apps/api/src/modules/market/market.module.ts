import { Module } from '@nestjs/common';
import { MarketController } from './market.controller';
import { MarketService } from './market.service';
import { MarketDataProviderFactory } from './market-data.provider';

@Module({
  controllers: [MarketController],
  providers: [MarketService, MarketDataProviderFactory],
  exports: [MarketService],
})
export class MarketModule {}
