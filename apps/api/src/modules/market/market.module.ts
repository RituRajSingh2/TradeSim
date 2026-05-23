import { Module } from '@nestjs/common';
import { MarketService } from './market.service';
import { MarketController } from './market.controller';
import { YahooFinanceProvider, MockMarketProvider } from './market-data.provider';
import { AlphaVantageProvider } from './alpha-vantage.provider';
import { ProviderManager } from './provider-manager';
import { HistoryService } from './history.service';
import { HistorySeederService } from './history-seeder.service';
import { PlatformLogger } from '../../common/logger/logger.service';
import { MetricsAggregatorService } from '../../common/logger/metrics.service';

@Module({
  controllers: [MarketController],
  providers: [
    MarketService,
    YahooFinanceProvider,
    AlphaVantageProvider,
    MockMarketProvider,
    {
      provide: ProviderManager,
      useFactory: (
        logger,
        metrics,
        yahoo,
        alpha,
        mock
      ) => {
        const pm = new ProviderManager(logger, metrics);
        // Register in order of priority: Primary, Secondary, Mock
        pm.registerProvider(yahoo, 'YahooFinance', false);
        pm.registerProvider(alpha, 'AlphaVantage', false);
        pm.registerProvider(mock, 'MockMarket', true);
        return pm;
      },
      inject: [
        PlatformLogger, 
        MetricsAggregatorService,
        YahooFinanceProvider, 
        AlphaVantageProvider, 
        MockMarketProvider
      ],
    },
    HistoryService,
    HistorySeederService,
  ],
  exports: [MarketService, ProviderManager],
})
export class MarketModule {}
