// ============================================
// Leaderboard Schemas
// ============================================

import { z } from 'zod/v4';

// ---- Enums ----

export const LeaderboardTypeSchema = z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']);
export type LeaderboardType = z.infer<typeof LeaderboardTypeSchema>;

export const LeaderboardFilterSchema = z.enum(['GLOBAL', 'INDIA', 'STATE', 'CITY']);
export type LeaderboardFilter = z.infer<typeof LeaderboardFilterSchema>;

// ---- Entry ----

export const LeaderboardEntrySchema = z.object({
  rank: z.number().int().positive(),
  userId: z.string(),
  userName: z.string(),
  avatarUrl: z.string().nullable(),
  profitPercent: z.number(),
  portfolioValue: z.number(),
  winRate: z.number(),
  totalTrades: z.number().int(),
});
export type LeaderboardEntry = z.infer<typeof LeaderboardEntrySchema>;

// ---- Request ----

export const LeaderboardRequestSchema = z.object({
  type: LeaderboardTypeSchema.default('DAILY'),
  filter: LeaderboardFilterSchema.default('GLOBAL'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type LeaderboardRequest = z.infer<typeof LeaderboardRequestSchema>;
