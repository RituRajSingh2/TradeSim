// ============================================
// Watchlist Schemas
// ============================================

import { z } from 'zod/v4';
import { IdSchema, SymbolSchema } from './base';

// ---- Watchlist Item ----

export const WatchlistItemSchema = z.object({
  id: IdSchema,
  watchlistId: IdSchema,
  symbol: z.string(),
  companyName: z.string(),
  addedAt: z.string(),
});
export type WatchlistItem = z.infer<typeof WatchlistItemSchema>;

// ---- Watchlist ----

export const WatchlistSchema = z.object({
  id: IdSchema,
  userId: IdSchema,
  name: z.string(),
  items: z.array(WatchlistItemSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Watchlist = z.infer<typeof WatchlistSchema>;

// ---- Create Watchlist ----

export const CreateWatchlistRequestSchema = z.object({
  name: z.string().min(1).max(50),
});
export type CreateWatchlistRequest = z.infer<typeof CreateWatchlistRequestSchema>;

// ---- Add Item ----

export const AddWatchlistItemRequestSchema = z.object({
  symbol: SymbolSchema,
  companyName: z.string().min(1),
});
export type AddWatchlistItemRequest = z.infer<typeof AddWatchlistItemRequestSchema>;
