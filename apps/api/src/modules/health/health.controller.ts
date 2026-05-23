import { Controller, Get, HttpCode, HttpStatus, Logger, Res } from '@nestjs/common';
import { Response } from 'express';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { ProviderManager } from '../market/provider-manager';
import { TradingGateway } from '../websocket/websocket.gateway';
import { PlatformEvent } from '@tradesim/shared';

// ============================================================
// Health Controller
//
// /health/live  — Liveness:  Is the process alive + event loop responsive?
// /health/ready — Readiness: Are all dependencies reachable and initialised?
//
// Load balancers should use:
//   - /health/live  for container restart decisions
//   - /health/ready for traffic routing decisions (rolling deploys)
//
// All checks are lightweight — no expensive DB queries.
// ============================================================

interface CheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  latencyMs?: number;
  reason?: string;
}

interface LivenessResponse {
  status: 'alive';
  uptimeSeconds: number;
  timestamp: string;
}

interface ReadinessResponse {
  status: 'ready' | 'not_ready';
  checks: Record<string, CheckResult>;
  timestamp: string;
}

@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly providerManager: ProviderManager,
    private readonly gateway: TradingGateway,
  ) {}

  /**
   * GET /health/live
   *
   * Liveness probe: is the Node.js process alive and event-loop responsive?
   * Returns 200 if alive. Never returns a non-2xx for dependency failures
   * (that is readiness's job). Used by Docker HEALTHCHECK and K8s livenessProbe.
   */
  @Get('live')
  @HttpCode(HttpStatus.OK)
  live(): LivenessResponse {
    return {
      status: 'alive',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * GET /health/ready
   *
   * Readiness probe: are all required downstream dependencies available?
   * Returns 200 when ready, 503 when any check fails.
   * Used by load balancers to gate traffic during rolling deploys.
   *
   * Checks (all lightweight — no heavy queries):
   *   - PostgreSQL: isHealthy flag + low-cost SELECT 1
   *   - Redis:      isHealthy flag + PING
   *   - Provider:   isInitialized + isReady flags (no network call)
   *   - WebSocket:  server initialised (no network call)
   */
  @Get('ready')
  async ready(@Res({ passthrough: true }) res: Response): Promise<ReadinessResponse> {
    const result = await this.runReadinessChecks();
    if (result.status === 'not_ready') {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }
    return result;
  }

  private async runReadinessChecks(): Promise<ReadinessResponse> {
    const checks: Record<string, CheckResult> = {};

    // ---- 1. PostgreSQL ----
    // Uses the cached isHealthy flag first; only runs SELECT 1 if flag is true
    // to avoid cascading load when DB is already known-down.
    const dbStart = Date.now();
    let dbHealthy = false;
    try {
      if (this.prisma.isHealthy) {
        await this.prisma.$queryRaw`SELECT 1`;
        dbHealthy = true;
      }
    } catch {
      dbHealthy = false;
    }
    checks.postgres = {
      status: dbHealthy ? 'healthy' : 'unhealthy',
      latencyMs: Date.now() - dbStart,
      ...(!dbHealthy && { reason: 'Database SELECT 1 failed or connection not established' }),
    };

    // ---- 2. Redis ----
    // PING is O(1) with no side-effects; safe to run on every readiness poll.
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
      ...(!redisHealthy && { reason: 'Redis PING did not return PONG' }),
    };

    // ---- 3. Market Provider Manager ----
    // Pure in-memory flag check — zero network cost.
    const providerReady = this.providerManager.isInitialized && this.providerManager.isReady;
    checks.providerManager = {
      status: providerReady ? 'healthy' : 'degraded',
      ...(!providerReady && {
        reason: this.providerManager.isInitialized
          ? 'All providers circuit-breaker tripped'
          : 'ProviderManager not yet initialized',
      }),
    };

    // ---- 4. WebSocket Gateway ----
    // Checks that Socket.IO server object has been created by afterInit().
    const wsReady = this.gateway.isReady;
    checks.websocket = {
      status: wsReady ? 'healthy' : 'degraded',
      ...(!wsReady && { reason: 'WebSocket server not yet initialized' }),
    };

    // ---- Aggregate ----
    const criticalChecks = [checks.postgres, checks.redis];
    const allCriticalHealthy = criticalChecks.every(c => c.status === 'healthy');
    const isReady = allCriticalHealthy; // providers/ws are degraded-safe for readiness

    if (!isReady) {
      const failedChecks = Object.entries(checks)
        .filter(([, v]) => v.status !== 'healthy')
        .map(([k, v]) => `${k}: ${v.reason ?? v.status}`);

      this.logger.warn({
        eventType: PlatformEvent.APP_EVENT,
        message: 'Readiness check failed — traffic should NOT be routed here',
        metadata: { failedChecks },
      });
    }

    return {
      status: isReady ? 'ready' : 'not_ready',
      checks,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * GET /health
   *
   * Legacy combined check retained for backward-compat with existing tooling.
   * Returns a merged view; not intended for load-balancer probes.
   */
  @Get()
  async check() {
    const [liveness, readiness] = await Promise.all([
      Promise.resolve(this.live()),
      this.runReadinessChecks(),
    ]);
    return { liveness, readiness };
  }
}
