import { Injectable, Inject, Logger } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';
import { PrismaService } from '../../database/prisma.service';
import {
  MARKET_DATA_PROVIDER,
  type MarketDataProvider,
  type StockQuote,
  type OHLCVBar,
} from './market-data.provider';

// ============================================================
// Market Service — Business logic + Redis caching layer
// ============================================================

const REDIS_PREFIX = 'market:';
const QUOTE_TTL = 5; // seconds
const OHLCV_INTRADAY_TTL = 10;
const OHLCV_DAILY_TTL = 3600; // 1 hour
const MARKET_STATUS_TTL = 60;

@Injectable()
export class MarketService {
  private readonly logger = new Logger(MarketService.name);

  constructor(
    @Inject(MARKET_DATA_PROVIDER)
    private readonly provider: MarketDataProvider,
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  // ---- Quotes ----

  /**
   * Get a single stock quote with Redis caching.
   * Cache TTL: 5s — matches Yahoo's update frequency.
   */
  async getQuote(symbol: string): Promise<StockQuote> {
    const cacheKey = `${REDIS_PREFIX}quote:${symbol}`;

    // Try cache first
    const cached = await this.redis.getJson<StockQuote>(cacheKey);
    if (cached) return cached;

    // Cache miss — fetch from provider
    const quote = await this.provider.getQuote(symbol);

    // Cache with short TTL (fire-and-forget, don't await)
    this.redis.setJson(cacheKey, quote, QUOTE_TTL).catch(() => {});

    return quote;
  }

  /**
   * Get quotes for multiple symbols. Used by:
   * - Portfolio value calculation
   * - Watchlist price updates
   * - WebSocket price broadcaster
   *
   * Checks Redis cache per-symbol, fetches misses in bulk.
   */
  async getBulkQuotes(symbols: string[]): Promise<Map<string, StockQuote>> {
    const results = new Map<string, StockQuote>();
    const misses: string[] = [];

    // Check cache for each symbol
    for (const symbol of symbols) {
      const cached = await this.redis.getJson<StockQuote>(
        `${REDIS_PREFIX}quote:${symbol}`,
      );
      if (cached) {
        results.set(symbol, cached);
      } else {
        misses.push(symbol);
      }
    }

    // Fetch all cache misses from provider
    if (misses.length > 0) {
      const fetched = await this.provider.getBulkQuotes(misses);
      for (const [symbol, quote] of fetched) {
        results.set(symbol, quote);
        // Cache each (fire-and-forget)
        this.redis
          .setJson(`${REDIS_PREFIX}quote:${symbol}`, quote, QUOTE_TTL)
          .catch(() => {});
      }
    }

    return results;
  }

  // ---- OHLCV ----

  async getOHLCV(symbol: string, range = '1mo'): Promise<OHLCVBar[]> {
    const cacheKey = `${REDIS_PREFIX}ohlcv:${symbol}:${range}`;
    const ttl = ['1d', '5d'].includes(range)
      ? OHLCV_INTRADAY_TTL
      : OHLCV_DAILY_TTL;

    const cached = await this.redis.getJson<OHLCVBar[]>(cacheKey);
    if (cached) return cached;

    const bars = await this.provider.getOHLCV(symbol, range);

    this.redis.setJson(cacheKey, bars, ttl).catch(() => {});

    return bars;
  }

  // ---- Symbol Search ----

  /**
   * Search MarketSymbol table. Falls back to provider for unknown symbols.
   */
  async searchSymbols(query: string, limit = 10) {
    const results = await this.prisma.marketSymbol.findMany({
      where: {
        isActive: true,
        OR: [
          { symbol: { contains: query.toUpperCase(), mode: 'insensitive' } },
          { companyName: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: limit,
      orderBy: { symbol: 'asc' },
      select: {
        id: true,
        symbol: true,
        companyName: true,
        exchange: true,
        instrumentType: true,
        sector: true,
      },
    });

    return results;
  }

  // ---- Market Status ----

  /**
   * Compute whether the market is open based on IST time.
   * NSE trading hours: Mon-Fri 9:15 AM - 3:30 PM IST.
   */
  async getMarketStatus(): Promise<{
    isOpen: boolean;
    nextOpenAt: string | null;
    nextCloseAt: string | null;
  }> {
    const cacheKey = `${REDIS_PREFIX}status`;
    const cached = await this.redis.getJson<{
      isOpen: boolean;
      nextOpenAt: string | null;
      nextCloseAt: string | null;
    }>(cacheKey);
    if (cached) return cached;

    const now = new Date();
    // Convert to IST (UTC+5:30)
    const istOffset = 5.5 * 60 * 60 * 1000;
    const ist = new Date(now.getTime() + istOffset);

    const day = ist.getUTCDay(); // 0=Sun, 6=Sat
    const hours = ist.getUTCHours();
    const minutes = ist.getUTCMinutes();
    const timeMinutes = hours * 60 + minutes;

    const MARKET_OPEN = 9 * 60 + 15; // 9:15 AM
    const MARKET_CLOSE = 15 * 60 + 30; // 3:30 PM

    const isWeekday = day >= 1 && day <= 5;
    const isDuringHours =
      timeMinutes >= MARKET_OPEN && timeMinutes < MARKET_CLOSE;
    const isOpen = isWeekday && isDuringHours;

    const status = {
      isOpen,
      nextOpenAt: null as string | null,
      nextCloseAt: null as string | null,
    };

    if (isOpen) {
      // Market closes today at 3:30 PM IST
      const closeTime = new Date(ist);
      closeTime.setUTCHours(15, 30, 0, 0);
      status.nextCloseAt = new Date(
        closeTime.getTime() - istOffset,
      ).toISOString();
    }

    this.redis.setJson(cacheKey, status, MARKET_STATUS_TTL).catch(() => {});

    return status;
  }

  // ---- Trending / Top Movers ----

  /**
   * Get top movers by absolute % change.
   * Fetches quotes for all active symbols and sorts.
   */
  async getTrending(limit = 10): Promise<StockQuote[]> {
    const symbols = await this.prisma.marketSymbol.findMany({
      where: { isActive: true, instrumentType: 'EQUITY' },
      select: { symbol: true },
      take: 50,
    });

    const symbolList = symbols.map((s) => s.symbol);
    const quotes = await this.getBulkQuotes(symbolList);

    return Array.from(quotes.values())
      .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))
      .slice(0, limit);
  }
}
