// ============================================
// Auth Schemas — Login, OTP, Token Management
// ============================================

import { z } from 'zod/v4';
import { PhoneSchema } from './base';

// ---- Auth Token Pair ----

export const AuthTokensSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
});
export type AuthTokens = z.infer<typeof AuthTokensSchema>;

// ---- Send OTP ----

export const SendOtpRequestSchema = z.object({
  phone: PhoneSchema,
});
export type SendOtpRequest = z.infer<typeof SendOtpRequestSchema>;

export const SendOtpResponseSchema = z.object({
  /** Whether OTP was sent successfully */
  sent: z.boolean(),
  /** Masked phone for UI display (e.g. ****6789) */
  maskedPhone: z.string(),
  /** Seconds until user can request another OTP */
  retryAfterSeconds: z.number().int(),
});
export type SendOtpResponse = z.infer<typeof SendOtpResponseSchema>;

// ---- Verify OTP ----

export const VerifyOtpRequestSchema = z.object({
  phone: PhoneSchema,
  /** 6-digit OTP code */
  otp: z.string().length(6).regex(/^\d{6}$/, 'OTP must be 6 digits'),
  /** Firebase ID token obtained after OTP verification on client */
  firebaseIdToken: z.string().min(1),
  /** Referral code (optional, only on first login) */
  referralCode: z.string().optional(),
});
export type VerifyOtpRequest = z.infer<typeof VerifyOtpRequestSchema>;

export const VerifyOtpResponseSchema = z.object({
  user: z.object({
    id: z.string(),
    phone: z.string(),
    name: z.string().nullable(),
    isNewUser: z.boolean(),
  }),
  tokens: AuthTokensSchema,
});
export type VerifyOtpResponse = z.infer<typeof VerifyOtpResponseSchema>;

// ---- Refresh Token ----

export const RefreshTokenRequestSchema = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshTokenRequest = z.infer<typeof RefreshTokenRequestSchema>;

export const RefreshTokenResponseSchema = z.object({
  accessToken: z.string().min(1),
});
export type RefreshTokenResponse = z.infer<typeof RefreshTokenResponseSchema>;

// ---- Logout ----

export const LogoutRequestSchema = z.object({
  /** Optional: invalidate all sessions for this user */
  allDevices: z.boolean().default(false),
});
export type LogoutRequest = z.infer<typeof LogoutRequestSchema>;
