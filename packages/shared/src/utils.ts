// ============================================
// Shared Utility Functions
// ============================================

import { CURRENCY_SYMBOL } from './constants';
import type { Staleness } from './schemas/market';

/**
 * Format a number as Indian currency (₹1,23,456.78)
 */
export function formatCurrency(value: number, showSymbol = true): string {
  const absValue = Math.abs(value);
  const formatted = absValue.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const sign = value < 0 ? '-' : '';
  return `${sign}${showSymbol ? CURRENCY_SYMBOL : ''}${formatted}`;
}

/**
 * Format a number as a compact currency value (₹1.2L, ₹3.5Cr)
 */
export function formatCompactCurrency(value: number): string {
  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (absValue >= 1_00_00_000) {
    return `${sign}${CURRENCY_SYMBOL}${(absValue / 1_00_00_000).toFixed(1)}Cr`;
  }
  if (absValue >= 1_00_000) {
    return `${sign}${CURRENCY_SYMBOL}${(absValue / 1_00_000).toFixed(1)}L`;
  }
  if (absValue >= 1_000) {
    return `${sign}${CURRENCY_SYMBOL}${(absValue / 1_000).toFixed(1)}K`;
  }
  return `${sign}${CURRENCY_SYMBOL}${absValue.toFixed(2)}`;
}

/**
 * Format a percentage value with sign
 */
export function formatPercent(value: number, decimals = 2): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)}%`;
}

/**
 * Format a number with Indian number system grouping (1,23,456)
 */
export function formatNumber(value: number, decimals = 2): string {
  return value.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format stock quantity
 */
export function formatQuantity(qty: number): string {
  return qty.toLocaleString('en-IN');
}

/**
 * Format a timestamp to readable date string
 */
export function formatDate(timestamp: string | number | Date): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Format a timestamp to readable time string
 */
export function formatTime(timestamp: string | number | Date): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

/**
 * Format a timestamp to readable date+time string
 */
export function formatDateTime(timestamp: string | number | Date): string {
  return `${formatDate(timestamp)}, ${formatTime(timestamp)}`;
}

/**
 * Format relative time (e.g., "2 hours ago", "just now")
 */
export function formatRelativeTime(timestamp: string | number | Date): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diffSeconds = Math.floor((now - then) / 1000);

  if (diffSeconds < 60) return 'just now';
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
  if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
  if (diffSeconds < 604800) return `${Math.floor(diffSeconds / 86400)}d ago`;
  return formatDate(timestamp);
}

/**
 * Generate a referral code from user ID
 */
export function generateReferralCode(userId: string): string {
  const hash = userId.replace(/-/g, '').substring(0, 6).toUpperCase();
  return `TS${hash}`;
}

/**
 * Truncate a string to max length with ellipsis
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return `${str.substring(0, maxLength)}…`;
}

/**
 * Mask a phone number for display (e.g., ****6789)
 */
export function maskPhone(phone: string): string {
  if (phone.length < 4) return phone;
  return `****${phone.slice(-4)}`;
}

/**
 * Delay execution for given milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Clamp a value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Deterministic priorities for market data staleness severity
 */
export const STALENESS_PRIORITY: Record<Staleness, number> = {
  fresh: 0,
  delayed: 1,
  critical: 2,
  expired: 3,
};

/**
 * Compare two staleness tiers and return the most degraded (worst) one.
 */
export function getWorstStaleness(a: Staleness, b: Staleness): Staleness {
  return STALENESS_PRIORITY[a] >= STALENESS_PRIORITY[b] ? a : b;
}
