// ============================================
// Base Schemas — Pagination, API Envelope, Common Primitives
// ============================================

import { z } from 'zod/v4';

// ---- Common Primitives ----

/** CUID / UUID string identifier */
export const IdSchema = z.string().min(1);

/** ISO 8601 date string */
export const DateStringSchema = z.string().datetime();

/** Indian phone number (10 digits, no country code) */
export const PhoneSchema = z
  .string()
  .regex(/^[6-9]\d{9}$/, 'Valid Indian phone number required');

/** Positive currency amount in INR */
export const AmountSchema = z.number().nonnegative();

/** Stock symbol (uppercase, 2-20 chars) */
export const SymbolSchema = z
  .string()
  .min(1)
  .max(20)
  .transform((s) => s.toUpperCase());

// ---- Pagination ----

export const PaginationRequestSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginationRequest = z.infer<typeof PaginationRequestSchema>;

export const PaginatedResponseSchema = <T extends z.ZodType>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    total: z.number(),
    page: z.number(),
    pageSize: z.number(),
    totalPages: z.number(),
    hasMore: z.boolean(),
  });

// ---- API Envelope ----

export const ApiSuccessSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
    message: z.string().optional(),
    timestamp: z.string(),
  });

export const ApiErrorSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.string(), z.unknown()).optional(),
  }),
  timestamp: z.string(),
});

// Inferred types
export type ApiSuccess<T> = { success: true; data: T; message?: string; timestamp: string };
export type ApiError = z.infer<typeof ApiErrorSchema>;
