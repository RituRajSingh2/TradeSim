import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../redis/redis.service';

interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number;
  checks: Record<string, { status: string; latencyMs: number }>;
  timestamp: string;
}

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get()
  async check(): Promise<HealthCheckResult> {
    const checks: Record<string, { status: string; latencyMs: number }> = {};

    // Database check — uses dedicated healthCheck method
    const dbStart = Date.now();
    const dbHealthy = await this.prisma.healthCheck();
    checks.database = {
      status: dbHealthy ? 'healthy' : 'unhealthy',
      latencyMs: Date.now() - dbStart,
    };

    // Redis check — uses isHealthy state + ping
    const redisStart = Date.now();
    let redisHealthy = false;
    try {
      const pong = await this.redis.getClient().ping();
      redisHealthy = pong === 'PONG';
    } catch {
      redisHealthy = false;
    }
    checks.redis = {
      status: redisHealthy ? 'healthy' : 'unhealthy',
      latencyMs: Date.now() - redisStart,
    };

    const allHealthy = Object.values(checks).every((c) => c.status === 'healthy');
    const anyHealthy = Object.values(checks).some((c) => c.status === 'healthy');

    return {
      status: allHealthy ? 'healthy' : anyHealthy ? 'degraded' : 'unhealthy',
      version: '0.1.0',
      uptime: Math.floor(process.uptime()),
      checks,
      timestamp: new Date().toISOString(),
    };
  }
}
