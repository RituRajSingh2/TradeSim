import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './redis/redis.module';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { MarketModule } from './modules/market/market.module';
import { TradingModule } from './modules/trading/trading.module';
import { PortfolioModule } from './modules/portfolio/portfolio.module';
import { WebsocketModule } from './modules/websocket/websocket.module';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import configuration from './config/configuration';
import { validateEnv } from './config/env.validation';

@Module({
  imports: [
    // ---- Configuration ----
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnv,
    }),

    // ---- JWT (global so JwtAuthGuard can inject JwtService anywhere) ----
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.secret'),
        signOptions: {
          expiresIn: config.get<string>('jwt.expiration', '15m'),
        },
      }),
    }),

    // ---- Rate Limiting (config-driven, not hardcoded) ----
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.get<number>('throttle.ttl', 60) * 1000,
          limit: config.get<number>('throttle.limit', 100),
        },
      ],
    }),

    // ---- CRON / Scheduled Tasks ----
    ScheduleModule.forRoot(),

    // ---- Infrastructure ----
    DatabaseModule,
    RedisModule,

    // ---- Feature Modules ----
    HealthModule,
    AuthModule,
    MarketModule,
    TradingModule,
    PortfolioModule,
    WebsocketModule,

    // Future modules:
    // WatchlistModule,
    // LeaderboardModule,
    // ReferralModule,
    // PaymentModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
