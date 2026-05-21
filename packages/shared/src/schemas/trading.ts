// ============================================
// Trading Schemas — Orders, Ledger Entries
// ============================================

import { z } from 'zod/v4';
import { IdSchema, SymbolSchema, AmountSchema } from './base';

// ---- Enums ----

export const OrderSideSchema = z.enum(['BUY', 'SELL']);
export type OrderSide = z.infer<typeof OrderSideSchema>;

export const OrderStatusSchema = z.enum([
  'PENDING', 'EXECUTED', 'PARTIALLY_FILLED', 'CANCELLED', 'FAILED', 'EXPIRED',
]);
export type OrderStatus = z.infer<typeof OrderStatusSchema>;

export const OrderTypeSchema = z.enum(['MARKET', 'LIMIT', 'STOP_LOSS']);
export type OrderType = z.infer<typeof OrderTypeSchema>;

export const ChartTimeframeSchema = z.enum(['10s', '30s', '1m', '5m', '15m', '1h', '1D', '1W', '1M', '1Y']);
export type ChartTimeframe = z.infer<typeof ChartTimeframeSchema>;

export const LedgerTypeSchema = z.enum(['CREDIT', 'DEBIT']);
export type LedgerType = z.infer<typeof LedgerTypeSchema>;

export const LedgerCategorySchema = z.enum([
  'SIGNUP_BONUS',
  'REFERRAL_BONUS',
  'PURCHASE_TOPUP',
  'BUY_ORDER',
  'SELL_ORDER',
  'ADMIN_ADJUSTMENT',
]);
export type LedgerCategory = z.infer<typeof LedgerCategorySchema>;

// ---- Order ----

export const OrderSchema = z.object({
  id: IdSchema,
  userId: IdSchema,
  symbolId: IdSchema,
  symbol: z.string(),
  companyName: z.string(),
  exchange: z.string(),
  side: OrderSideSchema,
  type: OrderTypeSchema,
  quantity: z.number().int().positive(),
  filledQuantity: z.number().int(),
  price: AmountSchema,
  totalValue: AmountSchema,
  status: OrderStatusSchema,
  executedAt: z.string().nullable(),
  cancelledAt: z.string().nullable(),
  failureReason: z.string().nullable(),
  createdAt: z.string(),
});
export type Order = z.infer<typeof OrderSchema>;

// ---- Place Order ----

export const PlaceOrderRequestSchema = z.object({
  symbol: SymbolSchema,
  side: OrderSideSchema,
  type: OrderTypeSchema.default('MARKET'),
  quantity: z.number().int().positive().max(10000, 'Maximum 10,000 shares per order'),
  /** Required for LIMIT and STOP_LOSS orders */
  limitPrice: z.number().positive().optional(),
  idempotencyKey: z.string().uuid().optional(),
});
export type PlaceOrderRequest = z.infer<typeof PlaceOrderRequestSchema>;

export const PlaceOrderResponseSchema = z.object({
  order: OrderSchema,
});
export type PlaceOrderResponse = z.infer<typeof PlaceOrderResponseSchema>;

// ---- Cancel Order ----

export const CancelOrderRequestSchema = z.object({
  orderId: IdSchema,
});
export type CancelOrderRequest = z.infer<typeof CancelOrderRequestSchema>;

// ---- Order History ----

export const OrderHistoryRequestSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: OrderStatusSchema.optional(),
  side: OrderSideSchema.optional(),
  symbol: z.string().optional(),
});
export type OrderHistoryRequest = z.infer<typeof OrderHistoryRequestSchema>;

// ---- Ledger Entry (immutable transaction) ----

export const LedgerEntrySchema = z.object({
  id: IdSchema,
  userId: IdSchema,
  entryType: LedgerTypeSchema,
  category: LedgerCategorySchema,
  amount: z.number(),
  runningBalance: z.number(),
  idempotencyKey: z.string().nullable(),
  orderId: z.string().nullable(),
  paymentId: z.string().nullable(),
  referralId: z.string().nullable(),
  description: z.string(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.string(),
});
export type LedgerEntry = z.infer<typeof LedgerEntrySchema>;
