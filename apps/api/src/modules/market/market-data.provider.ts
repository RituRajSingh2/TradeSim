import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// ============================================================
// Market Data Provider — Abstraction over price data sources
// ============================================================

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
}

export interface OHLCVBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MarketDataProvider {
  getQuote(symbol: string): Promise<StockQuote>;
  getBulkQuotes(symbols: string[]): Promise<Map<string, StockQuote>>;
  getOHLCV(symbol: string, range?: string): Promise<OHLCVBar[]>;
}

// ============================================================
// Yahoo Finance Provider — Real market data
// ============================================================

@Injectable()
export class YahooFinanceProvider implements MarketDataProvider {
  private readonly logger = new Logger(YahooFinanceProvider.name);

  async getQuote(symbol: string): Promise<StockQuote> {
    try {
      // Dynamic import — yahoo-finance2 typing varies by version
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const yahooFinance = await import('yahoo-finance2') as any;
      const yf = yahooFinance.default || yahooFinance;

      const nseSymbol = `${symbol}.NS`;
      const result = await yf.quote(nseSymbol) as Record<string, unknown>;

      return {
        symbol,
        companyName: (result.shortName || result.longName || symbol) as string,
        ltp: (result.regularMarketPrice ?? 0) as number,
        open: (result.regularMarketOpen ?? 0) as number,
        high: (result.regularMarketDayHigh ?? 0) as number,
        low: (result.regularMarketDayLow ?? 0) as number,
        close: (result.regularMarketPrice ?? 0) as number,
        previousClose: (result.regularMarketPreviousClose ?? 0) as number,
        volume: (result.regularMarketVolume ?? 0) as number,
        change: (result.regularMarketChange ?? 0) as number,
        changePercent: (result.regularMarketChangePercent ?? 0) as number,
        timestamp: Date.now(),
      };
    } catch (error) {
      this.logger.error(`Yahoo Finance error for ${symbol}: ${error}`);
      throw error;
    }
  }

  async getBulkQuotes(symbols: string[]): Promise<Map<string, StockQuote>> {
    const results = new Map<string, StockQuote>();

    // Yahoo Finance doesn't have a reliable bulk API —
    // fetch in parallel with concurrency limit
    const BATCH_SIZE = 5;
    for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
      const batch = symbols.slice(i, i + BATCH_SIZE);
      const promises = batch.map(async (symbol) => {
        try {
          const quote = await this.getQuote(symbol);
          results.set(symbol, quote);
        } catch {
          this.logger.warn(`Failed to fetch ${symbol}, skipping`);
        }
      });
      await Promise.all(promises);
    }

    return results;
  }

  async getOHLCV(symbol: string, range = '1mo'): Promise<OHLCVBar[]> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const yahooFinance = await import('yahoo-finance2') as any;
      const yf = yahooFinance.default || yahooFinance;

      const nseSymbol = `${symbol}.NS`;
      const result = await yf.chart(nseSymbol, {
        period1: this.getRangeStartDate(range),
        interval: this.getInterval(range),
      }) as Record<string, unknown>;

      const quotes = result?.quotes as Array<Record<string, unknown>> | undefined;
      if (!quotes) return [];

      return quotes.map((q) => ({
        time: new Date(q.date as string).getTime() / 1000,
        open: (q.open as number) ?? 0,
        high: (q.high as number) ?? 0,
        low: (q.low as number) ?? 0,
        close: (q.close as number) ?? 0,
        volume: (q.volume as number) ?? 0,
      }));
    } catch (error) {
      this.logger.error(`Yahoo OHLCV error for ${symbol}: ${error}`);
      return [];
    }
  }

  private getRangeStartDate(range: string): string {
    const now = new Date();
    const map: Record<string, number> = {
      '1d': 1, '5d': 5, '1mo': 30, '3mo': 90,
      '6mo': 180, '1y': 365, '5y': 1825,
    };
    const days = map[range] || 30;
    now.setDate(now.getDate() - days);
    return now.toISOString().split('T')[0];
  }

  private getInterval(range: string): string {
    const map: Record<string, string> = {
      '1d': '5m', '5d': '15m', '1mo': '1d',
      '3mo': '1d', '6mo': '1wk', '1y': '1wk', '5y': '1mo',
    };
    return map[range] || '1d';
  }
}

// ============================================================
// Mock Provider — Deterministic fake prices for dev/test
// ============================================================

@Injectable()
export class MockMarketProvider implements MarketDataProvider {
  private readonly logger = new Logger(MockMarketProvider.name);
  private readonly basePrices = new Map<string, number>([
    ['RELIANCE', 2450], ['TCS', 3800], ['HDFCBANK', 1650],
    ['INFY', 1520], ['ICICIBANK', 1080], ['HINDUNILVR', 2350],
    ['ITC', 440], ['SBIN', 620], ['BHARTIARTL', 1150],
    ['KOTAKBANK', 1750], ['LT', 3200], ['AXISBANK', 1050],
    ['WIPRO', 480], ['ASIANPAINT', 2800], ['MARUTI', 10500],
    ['HCLTECH', 1400], ['SUNPHARMA', 1180], ['TITAN', 3100],
    ['BAJFINANCE', 6500], ['TATAMOTORS', 650], ['NTPC', 310],
    ['POWERGRID', 280], ['ULTRACEMCO', 8200], ['NESTLEIND', 22000],
    ['TECHM', 1250], ['ADANIENT', 2400], ['ADANIPORTS', 850],
    ['DIVISLAB', 3600], ['BAJAJFINSV', 1550], ['ONGC', 250],
    ['NIFTY 50', 22500], ['SENSEX', 74000], ['NIFTY BANK', 48000],
  ]);

  async getQuote(symbol: string): Promise<StockQuote> {
    const basePrice = this.basePrices.get(symbol) || 1000;

    // Deterministic-ish variation: ±2% range based on time
    const seed = Date.now() / 5000; // changes every 5s
    const variation = Math.sin(seed + symbol.length) * 0.02;
    const ltp = +(basePrice * (1 + variation)).toFixed(2);
    const previousClose = basePrice;
    const change = +(ltp - previousClose).toFixed(2);
    const changePercent = +((change / previousClose) * 100).toFixed(2);

    return {
      symbol,
      companyName: `${symbol} Ltd`,
      ltp,
      open: +(basePrice * (1 + variation * 0.3)).toFixed(2),
      high: +(basePrice * (1 + Math.abs(variation) + 0.005)).toFixed(2),
      low: +(basePrice * (1 - Math.abs(variation) - 0.003)).toFixed(2),
      close: ltp,
      previousClose,
      volume: Math.floor(1_000_000 + Math.random() * 5_000_000),
      change,
      changePercent,
      timestamp: Date.now(),
    };
  }

  async getBulkQuotes(symbols: string[]): Promise<Map<string, StockQuote>> {
    const results = new Map<string, StockQuote>();
    for (const symbol of symbols) {
      results.set(symbol, await this.getQuote(symbol));
    }
    return results;
  }

  async getOHLCV(symbol: string, range = '1mo'): Promise<OHLCVBar[]> {
    const basePrice = this.basePrices.get(symbol) || 1000;
    const bars: OHLCVBar[] = [];
    const days = range === '1d' ? 1 : range === '5d' ? 5 : 30;
    const now = Date.now();

    for (let i = days; i >= 0; i--) {
      const time = (now - i * 86400000) / 1000;
      const variation = Math.sin(i * 0.5 + symbol.length) * 0.03;
      const open = +(basePrice * (1 + variation)).toFixed(2);
      const close = +(basePrice * (1 + variation * 0.8)).toFixed(2);
      bars.push({
        time: Math.floor(time),
        open,
        high: +Math.max(open, close, basePrice * (1 + Math.abs(variation) + 0.01)).toFixed(2),
        low: +Math.min(open, close, basePrice * (1 - Math.abs(variation) - 0.005)).toFixed(2),
        close,
        volume: Math.floor(1_000_000 + Math.random() * 3_000_000),
      });
    }

    return bars;
  }
}

// ============================================================
// Provider Factory — Selects implementation based on env
// ============================================================

export const MARKET_DATA_PROVIDER = 'MARKET_DATA_PROVIDER';

export const MarketDataProviderFactory = {
  provide: MARKET_DATA_PROVIDER,
  inject: [ConfigService],
  useFactory: (config: ConfigService): MarketDataProvider => {
    const provider = config.get<string>('marketData.provider', 'mock');
    const logger = new Logger('MarketDataProviderFactory');

    if (provider === 'yahoo') {
      logger.log('📈 Using Yahoo Finance market data provider');
      return new YahooFinanceProvider();
    }

    logger.log('🧪 Using Mock market data provider');
    return new MockMarketProvider();
  },
};
