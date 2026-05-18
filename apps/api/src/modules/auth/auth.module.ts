import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { FirebaseService } from './firebase.service';

@Module({
  // DatabaseModule is @Global() — no import needed.
  // PrismaService, LockingRepository, LedgerRepository are injectable everywhere.
  controllers: [AuthController],
  providers: [AuthService, FirebaseService],
  exports: [AuthService, FirebaseService],
})
export class AuthModule {}
