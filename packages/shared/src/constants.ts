// ============================================
// Shared Constants
// ============================================

/** Default virtual balance credited on signup (in INR) */
export const DEFAULT_BALANCE = 10_000;

/** Referral bonus amount (in INR) */
export const REFERRAL_BONUS = 3_000;

/** Practice capital unlock price (in INR) */
export const TOPUP_PRICE = 99;

/** Practice capital unlock amount (in INR) */
export const TOPUP_AMOUNT = 10_000;

/** Maximum referrals per month */
export const MAX_REFERRALS_PER_MONTH = 10;

/** Maximum topup purchases per month */
export const MAX_TOPUPS_PER_MONTH = 5;

/** Currency code */
export const CURRENCY = 'INR';

/** Currency symbol */
export const CURRENCY_SYMBOL = '₹';

// ---- Market Constants ----

/** NSE market open time (IST) — 9:15 AM */
export const MARKET_OPEN_HOUR = 9;
export const MARKET_OPEN_MINUTE = 15;

/** NSE market close time (IST) — 3:30 PM */
export const MARKET_CLOSE_HOUR = 15;
export const MARKET_CLOSE_MINUTE = 30;

/** Market timezone */
export const MARKET_TIMEZONE = 'Asia/Kolkata';

/** Yahoo Finance NSE suffix */
export const NSE_SUFFIX = '.NS';

/** Market data poll interval (ms) */
export const MARKET_DATA_POLL_INTERVAL = 5_000;

// ---- Popular NSE Stocks ----

export const NSE_POPULAR_STOCKS = [
  { symbol: 'RELIANCE', name: 'Reliance Industries Ltd' },
  { symbol: 'TCS', name: 'Tata Consultancy Services Ltd' },
  { symbol: 'HDFCBANK', name: 'HDFC Bank Ltd' },
  { symbol: 'INFY', name: 'Infosys Ltd' },
  { symbol: 'ICICIBANK', name: 'ICICI Bank Ltd' },
  { symbol: 'HINDUNILVR', name: 'Hindustan Unilever Ltd' },
  { symbol: 'ITC', name: 'ITC Ltd' },
  { symbol: 'SBIN', name: 'State Bank of India' },
  { symbol: 'BHARTIARTL', name: 'Bharti Airtel Ltd' },
  { symbol: 'KOTAKBANK', name: 'Kotak Mahindra Bank Ltd' },
  { symbol: 'LT', name: 'Larsen & Toubro Ltd' },
  { symbol: 'AXISBANK', name: 'Axis Bank Ltd' },
  { symbol: 'WIPRO', name: 'Wipro Ltd' },
  { symbol: 'ASIANPAINT', name: 'Asian Paints Ltd' },
  { symbol: 'MARUTI', name: 'Maruti Suzuki India Ltd' },
  { symbol: 'TITAN', name: 'Titan Company Ltd' },
  { symbol: 'SUNPHARMA', name: 'Sun Pharmaceutical Industries Ltd' },
  { symbol: 'BAJFINANCE', name: 'Bajaj Finance Ltd' },
  { symbol: 'TATAMOTORS', name: 'Tata Motors Ltd' },
  { symbol: 'NESTLEIND', name: 'Nestle India Ltd' },
  { symbol: 'HCLTECH', name: 'HCL Technologies Ltd' },
  { symbol: 'ULTRACEMCO', name: 'UltraTech Cement Ltd' },
  { symbol: 'POWERGRID', name: 'Power Grid Corporation of India Ltd' },
  { symbol: 'NTPC', name: 'NTPC Ltd' },
  { symbol: 'ONGC', name: 'Oil & Natural Gas Corporation Ltd' },
  { symbol: 'TATASTEEL', name: 'Tata Steel Ltd' },
  { symbol: 'ADANIENT', name: 'Adani Enterprises Ltd' },
  { symbol: 'TECHM', name: 'Tech Mahindra Ltd' },
  { symbol: 'INDUSINDBK', name: 'IndusInd Bank Ltd' },
  { symbol: 'JSWSTEEL', name: 'JSW Steel Ltd' },
] as const;

// ---- Timeframe Labels ----

export const TIMEFRAME_LABELS: Record<string, string> = {
  '10s': '10 Sec',
  '30s': '30 Sec',
  '1m': '1 Min',
  '5m': '5 Min',
  '15m': '15 Min',
  '1h': '1 Hour',
  '1D': '1 Day',
  '1W': '1 Week',
  '1M': '1 Month',
  '1Y': '1 Year',
};

// ---- Chart Indicator Labels ----

export const INDICATOR_LABELS: Record<string, string> = {
  rsi: 'RSI',
  macd: 'MACD',
  ema: 'EMA',
  sma: 'SMA',
  vwap: 'VWAP',
  bollinger: 'Bollinger Bands',
};

// ---- Redis Key Patterns ----

export const REDIS_KEYS = {
  stockPrice: (symbol: string) => `stock:price:${symbol}`,
  stockOHLCV: (symbol: string, tf: string) => `stock:ohlcv:${symbol}:${tf}`,
  userSession: (userId: string) => `user:session:${userId}`,
  leaderboard: (type: string, filter: string) => `leaderboard:${type}:${filter}`,
  marketStatus: 'market:status',
  rateLimit: (ip: string) => `rate:limit:${ip}`,
} as const;

// ---- API Routes ----

export const API_ROUTES = {
  auth: {
    login: '/auth/login',
    refresh: '/auth/refresh',
    logout: '/auth/logout',
    me: '/auth/me',
  },
  users: {
    profile: '/users/profile',
    update: '/users/profile',
    stats: '/users/stats',
  },
  trading: {
    placeOrder: '/trading/orders',
    orderHistory: '/trading/orders',
    cancelOrder: (id: string) => `/trading/orders/${id}/cancel`,
  },
  portfolio: {
    get: '/portfolio',
    holdings: '/portfolio/holdings',
    transactions: '/portfolio/transactions',
  },
  market: {
    quote: (symbol: string) => `/market/quote/${symbol}`,
    search: '/market/search',
    ohlcv: (symbol: string) => `/market/ohlcv/${symbol}`,
    trending: '/market/trending',
    status: '/market/status',
  },
  watchlist: {
    list: '/watchlists',
    create: '/watchlists',
    get: (id: string) => `/watchlists/${id}`,
    delete: (id: string) => `/watchlists/${id}`,
    addItem: (id: string) => `/watchlists/${id}/items`,
    removeItem: (id: string, itemId: string) => `/watchlists/${id}/items/${itemId}`,
  },
  leaderboard: {
    get: '/leaderboard',
  },
  referral: {
    info: '/referral',
    apply: '/referral/apply',
  },
  payment: {
    createOrder: '/payment/order',
    verify: '/payment/verify',
  },
  health: '/health',
} as const;
