import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { PlatformLogger } from './common/logger/logger.service';
import type { AppConfig } from './config/config.types';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule, {
    logger:
      process.env.NODE_ENV === 'production'
        ? ['error', 'warn', 'log']
        : ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  const platformLogger = app.get(PlatformLogger);
  app.useLogger(platformLogger);

  const configService = app.get(ConfigService);
  const port = configService.get<AppConfig['port']>('port', 3001);
  const corsOrigin = configService.get<string>('cors.origin', 'http://localhost:3000');
  const nodeEnv = configService.get<string>('nodeEnv', 'development');

  // ---- Security ----
  app.use(
    helmet({
      contentSecurityPolicy: nodeEnv === 'production' ? undefined : false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  // ---- Cookie Parser (for httpOnly refresh tokens) ----
  app.use(cookieParser());

  // ---- CORS ----
  app.enableCors({
    origin: corsOrigin.split(',').map((o) => o.trim()),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id'],
  });

  // ---- API Prefix ----
  app.setGlobalPrefix('api', {
    exclude: ['health'],
  });

  // ---- Global Pipes ----
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      stopAtFirstError: true,
    }),
  );

  // ---- Global Filters ----
  app.useGlobalFilters(new HttpExceptionFilter());

  // ---- Global Interceptors ----
  app.useGlobalInterceptors(new LoggingInterceptor(), new TransformInterceptor());

  // ---- Graceful Shutdown ----
  app.enableShutdownHooks();

  await app.listen(port);

  logger.log(`🚀 TradeSim API listening on http://localhost:${port}`);
  logger.log(`📊 Environment: ${nodeEnv}`);
  logger.log(`🔒 CORS origins: ${corsOrigin}`);
}

bootstrap();
