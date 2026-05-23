import { Injectable } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';
import { SubscriptionManager } from '../websocket/subscription-manager';

@Injectable()
export class AdminMetricsService {
  constructor(
    private readonly redisService: RedisService,
    private readonly subscriptionManager: SubscriptionManager,
  ) {}

  async collectMetrics() {
    return {
      websocket: {
        activeConnections: this.subscriptionManager.getClientCount(),
        activeSubscriptions: this.subscriptionManager.getActiveSymbols().length,
      },
      redis: {
        isHealthy: this.redisService.isHealthy,
      },
      // TODO: Add more metrics like order count, etc.
    };
  }

  async deepHealthCheck() {
    // Perform actual pings
    let redisLatencyMs = -1;
    if (this.redisService.isHealthy) {
      const start = Date.now();
      try {
        await this.redisService.getClient().ping();
        redisLatencyMs = Date.now() - start;
      } catch (e) {
        // Ignore
      }
    }

    return {
      status: this.redisService.isHealthy ? 'ok' : 'degraded',
      components: {
        redis: {
          status: this.redisService.isHealthy ? 'ok' : 'error',
          latencyMs: redisLatencyMs,
        },
        websocket: {
          status: 'ok',
          connections: this.subscriptionManager.getClientCount(),
        },
      },
    };
  }
}
