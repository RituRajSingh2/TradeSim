import { Global, Module } from '@nestjs/common';
import { PlatformLogger } from './logger.service';

@Global()
@Module({
  providers: [PlatformLogger],
  exports: [PlatformLogger],
})
export class LoggerModule {}
