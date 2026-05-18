// ============================================
// Market Data Schemas — Quotes, OHLCV, Search
// ============================================

import { z } from 'zod/v4';

// ---- Timeframe ----

export const TimeframeSchema = z.enum([
  '10s', '30s', '1m', '5m', '15m', '1h', '1D', '1W', '1M', '1Y',
]);
export type Timeframe = z.infer<typeof TimeframeSchema>;

// ---- Stock Quote ----

export const StockQuoteSchema = z.object({
  symbol: z.string(),
  companyName: z.string(),
  ltp: z.number(),
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
  previousClose: z.number(),
  volume: z.number().int(),
  change: z.number(),
  changePercent: z.number(),
  timestamp: z.number(),
});
export type StockQuote = z.infer<typeof StockQuoteSchema>;

// ---- OHLCV Bar ----

export const OHLCVBarSchema = z.object({
  time: z.number(),
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
  volume: z.number().int(),
});
export type OHLCVBar = z.infer<typeof OHLCVBarSchema>;

// ---- Market Status ----

export const MarketStatusSchema = z.object({
  isOpen: z.boolean(),
  nextOpenAt: z.string().nullable(),
  nextCloseAt: z.string().nullable(),
});
export type MarketStatus = z.infer<typeof MarketStatusSchema>;

// ---- Search ----

export const StockSearchRequestSchema = z.object({
  query: z.string().min(1).max(50),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});
export type StockSearchRequest = z.infer<typeof StockSearchRequestSchema>;

export const StockSearchResultSchema = z.object({
  symbol: z.string(),
  companyName: z.string(),
  sector: z.string().optional(),
});
export type StockSearchResult = z.infer<typeof StockSearchResultSchema>;

// ---- OHLCV Request ----

export const OHLCVRequestSchema = z.object({
  symbol: z.string().min(1),
  timeframe: TimeframeSchema.default('1D'),
  from: z.coerce.number().int().optional(),
  to: z.coerce.number().int().optional(),
});
export type OHLCVRequest = z.infer<typeof OHLCVRequestSchema>;
