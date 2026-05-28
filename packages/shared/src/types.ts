// ============================================
// Shared Type Definitions
// ============================================

// ---- User ----

export interface User {
  id: string;
  phone: string;
  name: string | null;
  avatarUrl: string | null;
  referralCode: string;
  state: string | null;
  city: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile extends User {
  portfolio: Portfolio;
  stats: UserStats;
}

export interface UserStats {
  totalTrades: number;
  winRate: number;
  bestTrade: number;
  worstTrade: number;
  totalPnl: number;
  totalPnlPercent: number;
}

// ---- Portfolio ----

export interface Portfolio {
  id: string;
  userId: string;
  balance: number;
  investedValue: number;
  currentValue: number;
  totalPnl: number;
  totalPnlPercent: number;
  dayPnl: number;
  dayPnlPercent: number;
  createdAt: string;
  updatedAt: string;
}

export interface Holding {
  id: string;
  portfolioId: string;
  symbol: string;
  companyName: string;
  quantity: number;
  avgBuyPrice: number;
  currentPrice: number;
  investedValue: number;
  currentValue: number;
  pnl: number;
  pnlPercent: number;
  dayChange: number;
  dayChangePercent: number;
}

// ---- Trading ----

export enum OrderSide {
  BUY = 'BUY',
  SELL = 'SELL',
}

export enum OrderStatus {
  PENDING = 'PENDING',
  EXECUTED = 'EXECUTED',
  CANCELLED = 'CANCELLED',
  FAILED = 'FAILED',
}

export enum OrderType {
  MARKET = 'MARKET',
}

export interface Order {
  id: string;
  userId: string;
  symbol: string;
  companyName: string;
  side: OrderSide;
  type: OrderType;
  quantity: number;
  price: number;
  totalValue: number;
  status: OrderStatus;
  executedAt: string | null;
  createdAt: string;
}

export interface PlaceOrderRequest {
  symbol: string;
  side: OrderSide;
  quantity: number;
}

export interface PlaceOrderResponse {
  order: Order;
  portfolio: Portfolio;
}

// ---- Transaction ----

export enum TransactionType {
  CREDIT = 'CREDIT',
  DEBIT = 'DEBIT',
  SIGNUP_BONUS = 'SIGNUP_BONUS',
  REFERRAL_BONUS = 'REFERRAL_BONUS',
  PURCHASE_TOPUP = 'PURCHASE_TOPUP',
  BUY_ORDER = 'BUY_ORDER',
  SELL_ORDER = 'SELL_ORDER',
}

export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

// ---- Market Data ----

export interface StockQuote {
  symbol: string;
  companyName: string;
  ltp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  previousClose: number;
  volume: number;
  change: number;
  changePercent: number;
  timestamp: number;
  isStale?: boolean;
  isMock?: boolean;
}

export interface OHLCVBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export enum Timeframe {
  TEN_SECONDS = '10s',
  THIRTY_SECONDS = '30s',
  ONE_MINUTE = '1m',
  FIVE_MINUTES = '5m',
  FIFTEEN_MINUTES = '15m',
  ONE_HOUR = '1h',
  ONE_DAY = '1D',
  ONE_WEEK = '1W',
  ONE_MONTH = '1M',
  ONE_YEAR = '1Y',
}

export interface MarketStatus {
  isOpen: boolean;
  nextOpenAt: string | null;
  nextCloseAt: string | null;
}

export interface MarketSessionResponse {
  status: 'PREOPEN' | 'OPEN' | 'CLOSED' | 'WEEKEND';
  nextTransitionAt: string | null;
  serverTime: string;
}

// ============================================================
// ALERTS & NOTIFICATIONS
// ============================================================

export type AlertCondition = 'ABOVE' | 'BELOW';
export type AlertStatus = 'ACTIVE' | 'TRIGGERED' | 'CANCELLED';

export interface PriceAlert {
  id: string;
  userId: string;
  symbol: string;
  targetPrice: number | string;
  condition: AlertCondition;
  status: AlertStatus;
  createdAt: string;
  triggeredAt?: string | null;
}

export interface NotificationDto {
  id: string;
  title: string;
  message: string;
  type: 'ALERT' | 'SYSTEM' | 'ORDER';
  isRead: boolean;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface NotificationPreferences {
  marketOpen: boolean;
  eodSummary: boolean;
  watchlistAlerts: boolean;
}


// ---- Watchlist ----

export interface Watchlist {
  id: string;
  userId: string;
  name: string;
  items: WatchlistItem[];
  createdAt: string;
  updatedAt: string;
}

export interface WatchlistItem {
  id: string;
  watchlistId: string;
  symbol: string;
  companyName: string;
  addedAt: string;
}

// ---- Leaderboard ----

export enum LeaderboardType {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  YEARLY = 'YEARLY',
}

export enum LeaderboardFilter {
  GLOBAL = 'GLOBAL',
  INDIA = 'INDIA',
  STATE = 'STATE',
  CITY = 'CITY',
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  userName: string;
  avatarUrl: string | null;
  profitPercent: number;
  portfolioValue: number;
  winRate: number;
  totalTrades: number;
}

// ---- Referral ----

export enum ReferralStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  EXPIRED = 'EXPIRED',
}

export interface Referral {
  id: string;
  referrerId: string;
  referredUserId: string;
  status: ReferralStatus;
  completedAt: string | null;
  createdAt: string;
}

// ---- Payment ----

export enum PaymentStatus {
  CREATED = 'CREATED',
  AUTHORIZED = 'AUTHORIZED',
  CAPTURED = 'CAPTURED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

export interface Payment {
  id: string;
  userId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string | null;
  amount: number;
  currency: string;
  status: PaymentStatus;
  createdAt: string;
}



// ---- API Response Wrapper ----

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  timestamp: string;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  timestamp: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasMore: boolean;
}
