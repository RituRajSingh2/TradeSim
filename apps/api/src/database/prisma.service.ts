import { Injectable, OnModuleInit, OnApplicationShutdown, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient, Prisma } from '@prisma/client';
import { PlatformEvent } from '@tradesim/shared';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(PrismaService.name);
  private _isHealthy = false;

  constructor(private readonly configService: ConfigService) {
    const isProduction = configService.get('NODE_ENV') === 'production';

    super({
      datasources: {
        db: { url: configService.get<string>('database.url') },
      },
      log: isProduction
        ? [{ level: 'error', emit: 'stdout' }]
        : [
            { level: 'query', emit: 'event' },
            { level: 'error', emit: 'stdout' },
            { level: 'warn', emit: 'stdout' },
          ],
    });

    // Log slow queries in development
    if (!isProduction) {
      (this as PrismaClient).$on('query' as never, (event: Prisma.QueryEvent) => {
        if (event.duration > 200) {
          this.logger.warn(`Slow query (${event.duration}ms): ${event.query}`);
        }
      });
    }
  }

  /** Whether the database connection is healthy. */
  get isHealthy(): boolean {
    return this._isHealthy;
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      this._isHealthy = true;
      this.logger.log('✅ Database connected');
    } catch (error) {
      this._isHealthy = false;
      this.logger.error('❌ Database connection failed', error);

      if (this.configService.get('NODE_ENV') === 'production') {
        throw error;
      }
    }
  }

  async onApplicationShutdown(): Promise<void> {
    await this.$disconnect();
    this._isHealthy = false;
    this.logger.log({
      eventType: PlatformEvent.APP_SHUTDOWN_COMPLETED,
      message: 'Database disconnected gracefully',
      metadata: { service: 'Prisma' }
    });
  }

  /**
   * Execute a health check query.
   * Used by the health controller instead of exposing raw $queryRaw.
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      this._isHealthy = true;
      return true;
    } catch {
      this._isHealthy = false;
      return false;
    }
  }
}
