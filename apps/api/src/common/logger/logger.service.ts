import { ConsoleLogger, Injectable, LogLevel } from '@nestjs/common';
import { getRequestContext } from './logger.context';
import { AllEvents, PlatformEvent, MetricEvent, LogSeverity } from '@tradesim/shared';

export interface LogPayload {
  eventType?: AllEvents;
  message: string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

const SEVERITY_MAPPING: Record<AllEvents, LogSeverity> = {
  // INFO Events
  [PlatformEvent.ORDER_PLACED]: LogSeverity.INFO,
  [PlatformEvent.ORDER_EXECUTED]: LogSeverity.INFO,
  [PlatformEvent.WS_CONNECT]: LogSeverity.INFO,
  [PlatformEvent.WS_DISCONNECT]: LogSeverity.INFO,
  [PlatformEvent.WS_SUBSCRIBE]: LogSeverity.INFO,
  [PlatformEvent.WS_UNSUBSCRIBE]: LogSeverity.INFO,
  [PlatformEvent.WS_AUTH_REFRESH]: LogSeverity.INFO,
  [PlatformEvent.CRON_STARTED]: LogSeverity.INFO,
  [PlatformEvent.CRON_COMPLETED]: LogSeverity.INFO,
  [PlatformEvent.CRON_SNAPSHOT_GENERATED]: LogSeverity.INFO,
  [PlatformEvent.CRON_LEADERBOARD_REFRESHED]: LogSeverity.INFO,
  [PlatformEvent.APP_EVENT]: LogSeverity.INFO,
  [PlatformEvent.AUTH_SUCCESS]: LogSeverity.INFO,
  [PlatformEvent.USER_LOGOUT]: LogSeverity.INFO,
  [PlatformEvent.USER_REGISTERED]: LogSeverity.INFO,
  [PlatformEvent.MARKET_PROVIDER_MOCK_ACTIVATED]: LogSeverity.INFO,
  [PlatformEvent.APP_SHUTDOWN_STARTED]: LogSeverity.INFO,
  [PlatformEvent.APP_SHUTDOWN_COMPLETED]: LogSeverity.INFO,

  // WARN Events
  [PlatformEvent.ORDER_REJECTED_SLIPPAGE]: LogSeverity.WARN,
  [PlatformEvent.ORDER_REJECTED_STALE]: LogSeverity.WARN,
  [PlatformEvent.ORDER_REJECTED_FUNDS]: LogSeverity.WARN,
  [PlatformEvent.ORDER_IDEMPOTENCY_REPLAY]: LogSeverity.WARN,
  [PlatformEvent.ORDER_OPTIMISTIC_ROLLBACK]: LogSeverity.WARN,
  [PlatformEvent.WS_AUTH_EXPIRED]: LogSeverity.WARN,
  [PlatformEvent.WS_RECONNECT_ABUSE]: LogSeverity.WARN,
  [PlatformEvent.WS_DEGRADED]: LogSeverity.WARN,
  [PlatformEvent.WS_SESSION_EXPIRED]: LogSeverity.WARN,
  [PlatformEvent.MARKET_PROVIDER_FAILOVER]: LogSeverity.WARN,
  [PlatformEvent.MARKET_DATA_STALE]: LogSeverity.WARN,
  [PlatformEvent.MARKET_PROVIDER_LATENCY_SPIKE]: LogSeverity.WARN,
  [PlatformEvent.REDIS_RECONNECT]: LogSeverity.WARN,
  [PlatformEvent.RATE_LIMIT_EXCEEDED]: LogSeverity.WARN,
  [PlatformEvent.INVALID_TOKEN]: LogSeverity.WARN,
  [PlatformEvent.WS_AUTH_FAILED]: LogSeverity.WARN,
  [PlatformEvent.AUTH_FAILED]: LogSeverity.WARN,
  [PlatformEvent.CRON_BATCH_FAILED]: LogSeverity.WARN,
  [PlatformEvent.APP_SHUTDOWN_TIMEOUT]: LogSeverity.WARN,

  // ERROR Events
  [PlatformEvent.MARKET_PROVIDER_TRIPPED]: LogSeverity.ERROR,
  [PlatformEvent.MARKET_DATA_FETCH_FAILED]: LogSeverity.ERROR,
  [PlatformEvent.REDIS_LOCK_FAILED]: LogSeverity.ERROR,
  [PlatformEvent.REDIS_CACHE_FAILURE]: LogSeverity.ERROR,
  [PlatformEvent.REDIS_PUBSUB_FAILURE]: LogSeverity.ERROR,
  [PlatformEvent.ADMIN_ACCESS_DENIED]: LogSeverity.ERROR,

  // Metric Events (INFO by default)
  [MetricEvent.METRIC_WS_CONNECTION_COUNT]: LogSeverity.INFO,
  [MetricEvent.METRIC_PROVIDER_FAILOVER_COUNT]: LogSeverity.INFO,
  [MetricEvent.METRIC_STALE_QUOTE_COUNT]: LogSeverity.INFO,
  [MetricEvent.METRIC_ORDER_REJECTION_RATE]: LogSeverity.INFO,
  [MetricEvent.METRIC_REDIS_LOCK_CONTENTION]: LogSeverity.INFO,
};

const SENSITIVE_KEYS = new Set([
  'password', 'token', 'jwt', 'authorization', 'cookie', 
  'secret', 'otp', 'refreshToken', 'accessToken'
]);

@Injectable()
export class PlatformLogger extends ConsoleLogger {
  private isProduction = process.env.NODE_ENV === 'production';
  private schemaVersion = '1.0';

  constructor(context?: string) {
    super(context || 'App');
  }

  // Deeply scrub sensitive data, but shallowly serialize metadata to avoid deep recursion
  private scrubObject(obj: any, depth = 0, maxDepth = 2): any {
    if (depth >= maxDepth) return '[Truncated]';
    if (obj === null || obj === undefined) return obj;
    if (typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) {
      return obj.slice(0, 10).map(item => this.scrubObject(item, depth + 1, maxDepth));
    }

    const scrubbed: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (SENSITIVE_KEYS.has(key.toLowerCase()) || key.toLowerCase().includes('password') || key.toLowerCase().includes('token')) {
        scrubbed[key] = '[REDACTED]';
      } else {
        scrubbed[key] = this.scrubObject(value, depth + 1, maxDepth);
      }
    }
    return scrubbed;
  }

  private shouldSample(eventType?: AllEvents): boolean {
    const noisyEvents: AllEvents[] = [PlatformEvent.WS_SUBSCRIBE, PlatformEvent.WS_UNSUBSCRIBE];
    if (eventType && noisyEvents.includes(eventType)) {
      return Math.random() < 0.10; // 10% sampling
    }
    return true; 
  }

  private enforceSeverity(originalLevel: LogLevel, eventType?: AllEvents): string {
    if (!eventType) return originalLevel.toUpperCase();
    const forcedSeverity = SEVERITY_MAPPING[eventType];
    return forcedSeverity ? forcedSeverity.toUpperCase() : originalLevel.toUpperCase();
  }

  private formatJsonLog(level: LogLevel, message: any, context?: string): string {
    const ctx = getRequestContext();
    const timestamp = new Date().toISOString();

    let payload: LogPayload = { message: '' };
    
    if (typeof message === 'string') {
      payload.message = message;
    } else if (typeof message === 'object' && message !== null) {
      const { message: msg, eventType, metadata, ...rest } = message;
      payload = {
        message: msg || 'No message provided',
        eventType,
        metadata: { ...metadata, ...rest }
      };
    }

    if (!this.shouldSample(payload.eventType)) {
      return ''; // Sampled out
    }

    const actualSeverity = this.enforceSeverity(level, payload.eventType);

    const logEntry = {
      schemaVersion: this.schemaVersion,
      env: process.env.NODE_ENV || 'development',
      buildId: process.env.BUILD_ID || 'dev',
      timestamp,
      level: actualSeverity,
      requestId: ctx.requestId || undefined,
      sessionId: ctx.sessionId || undefined,
      socketId: ctx.socketId || undefined,
      userId: ctx.userId || undefined,
      idempotencyKey: ctx.idempotencyKey || undefined,
      executionId: ctx.executionId || undefined,
      context: context || this.context,
      eventType: payload.eventType || PlatformEvent.APP_EVENT,
      message: payload.message,
      metadata: payload.metadata ? this.scrubObject(payload.metadata) : undefined,
    };

    return JSON.stringify(logEntry);
  }

  log(message: any, context?: string) {
    if (!this.isLevelEnabled('log')) return;
    if (this.isProduction) {
      const json = this.formatJsonLog('log', message, context);
      if (json) process.stdout.write(json + '\n');
    } else {
      super.log(message, context);
    }
  }

  error(message: any, stack?: string, context?: string) {
    if (!this.isLevelEnabled('error')) return;
    if (this.isProduction) {
      let payload = message;
      if (typeof message === 'string') {
        payload = { message, metadata: { stack } };
      } else if (typeof message === 'object') {
        payload = { ...message, metadata: { ...message.metadata, stack } };
      }
      const json = this.formatJsonLog('error', payload, context);
      if (json) process.stderr.write(json + '\n');
    } else {
      super.error(message, stack, context);
    }
  }

  warn(message: any, context?: string) {
    if (!this.isLevelEnabled('warn')) return;
    if (this.isProduction) {
      const json = this.formatJsonLog('warn', message, context);
      if (json) process.stdout.write(json + '\n');
    } else {
      super.warn(message, context);
    }
  }

  debug(message: any, context?: string) {
    if (!this.isLevelEnabled('debug')) return;
    if (this.isProduction) {
      const json = this.formatJsonLog('debug', message, context);
      if (json) process.stdout.write(json + '\n');
    } else {
      super.debug(message, context);
    }
  }

  verbose(message: any, context?: string) {
    if (!this.isLevelEnabled('verbose')) return;
    if (this.isProduction) {
      const json = this.formatJsonLog('verbose', message, context);
      if (json) process.stdout.write(json + '\n');
    } else {
      super.verbose(message, context);
    }
  }
}
