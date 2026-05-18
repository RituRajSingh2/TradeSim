// ============================================
// User Schemas — Profile, Stats, Update
// ============================================

import { z } from 'zod/v4';
import { IdSchema, DateStringSchema, PhoneSchema } from './base';

// ---- User ----

export const UserSchema = z.object({
  id: IdSchema,
  phone: z.string(),
  name: z.string().nullable(),
  avatarUrl: z.string().url().nullable(),
  referralCode: z.string(),
  state: z.string().nullable(),
  city: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type User = z.infer<typeof UserSchema>;

// ---- User Stats ----

export const UserStatsSchema = z.object({
  totalTrades: z.number().int(),
  winRate: z.number(),
  bestTrade: z.number(),
  worstTrade: z.number(),
  totalPnl: z.number(),
  totalPnlPercent: z.number(),
});
export type UserStats = z.infer<typeof UserStatsSchema>;

// ---- Update Profile ----

export const UpdateProfileRequestSchema = z.object({
  name: z.string().min(2).max(50).optional(),
  state: z.string().max(50).optional(),
  city: z.string().max(50).optional(),
  avatarUrl: z.string().url().optional(),
});
export type UpdateProfileRequest = z.infer<typeof UpdateProfileRequestSchema>;

// ---- User Profile (compound) ----

export const UserProfileSchema = UserSchema.extend({
  stats: UserStatsSchema,
});
export type UserProfile = z.infer<typeof UserProfileSchema>;
