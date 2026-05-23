import { PlatformEvent, MetricEvent, LogSeverity } from '@tradesim/shared';

// For simplicity on frontend, we don't have AsyncLocalStorage, but we can store global context
// (like sessionId or userId) that gets injected into every log.
let globalContext: Record<string, string | undefined> = {};

export const setLoggerContext = (context: Record<string, string | undefined>) => {
  globalContext = { ...globalContext, ...context };
};

export interface FrontendLogPayload {
  eventType?: PlatformEvent | MetricEvent;
  message: string;
  metadata?: Record<string, unknown>;
  error?: Error;
}

export const logger = {
  info: (payload: FrontendLogPayload) => emitLog(LogSeverity.INFO, payload),
  warn: (payload: FrontendLogPayload) => emitLog(LogSeverity.WARN, payload),
  error: (payload: FrontendLogPayload) => emitLog(LogSeverity.ERROR, payload),
  debug: (payload: FrontendLogPayload) => emitLog(LogSeverity.DEBUG, payload),
};

const SENSITIVE_KEYS = new Set([
  'password', 'token', 'jwt', 'authorization', 'cookie', 
  'secret', 'otp', 'refreshToken', 'accessToken'
]);

function scrubObject(obj: any, depth = 0, maxDepth = 2): any {
  if (depth >= maxDepth) return '[Truncated]';
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.slice(0, 5).map(item => scrubObject(item, depth + 1, maxDepth));
  }

  const scrubbed: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase()) || key.toLowerCase().includes('password') || key.toLowerCase().includes('token')) {
      scrubbed[key] = '[REDACTED]';
    } else {
      scrubbed[key] = scrubObject(value, depth + 1, maxDepth);
    }
  }
  return scrubbed;
}

function emitLog(level: LogSeverity, payload: FrontendLogPayload) {
  // Never block the main thread - formatting can be slightly heavy
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    (window as any).requestIdleCallback(() => formatAndPrint(level, payload));
  } else {
    setTimeout(() => formatAndPrint(level, payload), 0);
  }
}

function formatAndPrint(level: LogSeverity, payload: FrontendLogPayload) {
  const timestamp = new Date().toISOString();
  
  const logEntry = {
    timestamp,
    level,
    env: process.env.NODE_ENV || 'development',
    eventType: payload.eventType || PlatformEvent.APP_EVENT,
    message: payload.message,
    ...globalContext, // Injects sessionId, userId, requestId etc
    metadata: payload.metadata ? scrubObject(payload.metadata) : undefined,
    error: payload.error ? { message: payload.error.message, stack: payload.error.stack } : undefined,
  };

  const jsonString = JSON.stringify(logEntry);

  // Print to console using native methods
  switch (level) {
    case LogSeverity.INFO:
      console.log(jsonString);
      break;
    case LogSeverity.WARN:
      console.warn(jsonString);
      break;
    case LogSeverity.ERROR:
      console.error(jsonString);
      break;
    default:
      console.debug(jsonString);
  }
}
