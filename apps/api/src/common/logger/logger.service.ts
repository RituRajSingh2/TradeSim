import { ConsoleLogger, Injectable, LogLevel } from '@nestjs/common';
import { getRequestContext } from './logger.context';

export interface LogPayload {
  eventType?: string;
  message: string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

@Injectable()
export class PlatformLogger extends ConsoleLogger {
  private isProduction = process.env.NODE_ENV === 'production';

  constructor(context?: string) {
    super(context || 'App');
  }

  // --- Sampling Logic ---
  // Sample highly noisy INFO events (e.g., 10% sampling)
  private shouldSample(level: LogLevel, eventType?: string): boolean {
    if (level === 'warn' || level === 'error' || level === 'fatal') return true; // Never sample warnings/errors
    
    const noisyEvents = ['WS_HEARTBEAT', 'WS_TICK_UPDATE', 'WS_RECONNECT'];
    if (eventType && noisyEvents.includes(eventType)) {
      // 10% sampling rate for noisy events
      return Math.random() < 0.10;
    }
    
    return true; // Log everything else
  }

  private formatJsonLog(level: LogLevel, message: any, context?: string): string {
    const ctx = getRequestContext();
    const timestamp = new Date().toISOString();

    let payload: LogPayload = { message: '' };
    
    if (typeof message === 'string') {
      payload.message = message;
    } else if (typeof message === 'object' && message !== null) {
      // Extract specific fields if it's our custom LogPayload
      const { message: msg, eventType, metadata, ...rest } = message;
      payload = {
        message: msg || 'No message provided',
        eventType,
        metadata: { ...metadata, ...rest }
      };
    }

    if (!this.shouldSample(level, payload.eventType)) {
      return ''; // Sampled out
    }

    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      requestId: ctx.requestId || undefined,
      userId: ctx.userId || undefined,
      socketId: ctx.socketId || undefined,
      executionId: ctx.executionId || undefined,
      context: context || this.context,
      eventType: payload.eventType || 'APP_EVENT',
      message: payload.message,
      metadata: Object.keys(payload.metadata || {}).length > 0 ? payload.metadata : undefined,
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
