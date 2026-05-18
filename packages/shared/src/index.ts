// ============================================
// @tradesim/shared — Public API
// ============================================

// Zod schemas (source of truth for types)
export * from './schemas';

// Transport-agnostic adapters
export * from './adapters';

// Legacy types (deprecated — use schemas instead)
// Kept temporarily for backward compatibility during migration.
// All new code should import types from schemas.
export type {
  ApiResponse,
  ApiErrorResponse,
  PaginatedResponse,
} from './types';

// Constants
export * from './constants';

// Utilities
export * from './utils';
