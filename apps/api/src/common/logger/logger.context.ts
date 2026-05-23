import { AsyncLocalStorage } from 'async_hooks';

export interface RequestContext {
  requestId?: string;
  userId?: string;
  socketId?: string;
  sessionId?: string;
  idempotencyKey?: string;
  executionId?: string;
}

// Global ALS instance for tracking request context across async boundaries
export const requestContext = new AsyncLocalStorage<RequestContext>();

/**
 * Helper to safely get the current request context.
 */
export function getRequestContext(): RequestContext {
  return requestContext.getStore() || {};
}
