import { Module } from '@nestjs/common';
import { BriefingController } from './briefing.controller';
import { BriefingService } from './briefing.service';
import { BriefingContextAssembler } from './briefing-context-assembler';
import { DatabaseModule } from '../../database/database.module';
import { RedisModule } from '../../redis/redis.module';

@Module({
  imports: [DatabaseModule, RedisModule],
  controllers: [BriefingController],
  providers: [BriefingService, BriefingContextAssembler],
  exports: [BriefingService],
})
export class BriefingModule {}
