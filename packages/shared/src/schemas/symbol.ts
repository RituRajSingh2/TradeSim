// ============================================
// MarketSymbol Schemas — Instrument Master Data
// ============================================

import { z } from 'zod/v4';
import { IdSchema } from './base';

// ---- Enums ----

export const ExchangeSchema = z.enum(['NSE', 'BSE']);
export type Exchange = z.infer<typeof ExchangeSchema>;

export const InstrumentTypeSchema = z.enum([
  'EQUITY', 'INDEX', 'ETF', 'FUTURES', 'OPTIONS',
]);
export type InstrumentType = z.infer<typeof InstrumentTypeSchema>;

// ---- MarketSymbol ----

export const MarketSymbolSchema = z.object({
  id: IdSchema,
  symbol: z.string(),
  exchange: ExchangeSchema,
  instrumentType: InstrumentTypeSchema,
  companyName: z.string(),
  isin: z.string().nullable(),
  sector: z.string().nullable(),
  industry: z.string().nullable(),
  lotSize: z.number().int().positive(),
  tickSize: z.number(),
  isActive: z.boolean(),
  lastSyncedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type MarketSymbol = z.infer<typeof MarketSymbolSchema>;
