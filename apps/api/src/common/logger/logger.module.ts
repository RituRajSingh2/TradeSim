import { Global, Module } from '@nestjs/common';
import { PlatformLogger } from './logger.service';
import { MetricsAggregatorService } from './metrics.service';

@Global()
@Module({
  providers: [PlatformLogger, MetricsAggregatorService],
  exports: [PlatformLogger, MetricsAggregatorService],
})
export class LoggerModule {}
