import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { LockingRepository } from './locking.repository';
import { LedgerRepository } from './ledger.repository';

@Global()
@Module({
  providers: [PrismaService, LockingRepository, LedgerRepository],
  exports: [PrismaService, LockingRepository, LedgerRepository],
})
export class DatabaseModule {}
