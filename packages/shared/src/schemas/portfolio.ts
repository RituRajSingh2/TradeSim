// ============================================
// Portfolio Schemas — Holdings, Portfolio Summary
// ============================================

import { z } from 'zod/v4';
import { IdSchema, AmountSchema } from './base';

// ---- Portfolio ----

export const PortfolioSchema = z.object({
  id: IdSchema,
  userId: IdSchema,
  balance: AmountSchema,
  investedValue: AmountSchema,
  currentValue: AmountSchema,
  totalPnl: z.number(),
  totalPnlPercent: z.number(),
  dayPnl: z.number(),
  dayPnlPercent: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Portfolio = z.infer<typeof PortfolioSchema>;

// ---- Holding ----

export const HoldingSchema = z.object({
  id: IdSchema,
  portfolioId: IdSchema,
  symbol: z.string(),
  companyName: z.string(),
  quantity: z.number().int().positive(),
  avgBuyPrice: AmountSchema,
  currentPrice: AmountSchema,
  investedValue: AmountSchema,
  currentValue: AmountSchema,
  pnl: z.number(),
  pnlPercent: z.number(),
  dayChange: z.number(),
  dayChangePercent: z.number(),
});
export type Holding = z.infer<typeof HoldingSchema>;
