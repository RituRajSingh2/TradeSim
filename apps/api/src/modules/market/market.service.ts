import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';
import { PrismaService } from '../../database/prisma.service';
import {
  type OHLCVBar,
} from './market-data.provider';
import { ProviderManager, ResilientStockQuote } from './provider-manager';
import { Staleness } from '@tradesim/shared';

// ============================================================
// Market Service — Business logic + Redis caching layer
// ============================================================

const REDIS_PREFIX = 'market:';
const CACHE_FRESH_TTL = 5; // seconds
const CACHE_STALE_TTL = 900; // 15 minutes (stale-while-revalidate window)
const OHLCV_INTRADAY_TTL = 10;
const OHLCV_DAILY_TTL = 3600; // 1 hour
const MARKET_STATUS_TTL = 60;

@Injectable()
export class MarketService {
  private readonly logger = new Logger(MarketService.name);

  private readonly pendingQuotes = new Map<string, Promise<ResilientStockQuote>>();

  constructor(
    private readonly provider: ProviderManager,
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  // ---- Quotes ----

  /**
   * Get a single stock quote with Redis caching.
   * Cache TTL: 5s — matches Yahoo's update frequency.
   */
  async getQuote(symbol: string): Promise<ResilientStockQuote> {
    const cacheKey = `${REDIS_PREFIX}quote:${symbol}`;

    // 1. Check Redis Cache
    const cached = await this.redis.getJson<ResilientStockQuote & { fetchedAt: number }>(cacheKey);
    if (cached) {
      const ageSeconds = (Date.now() - cached.fetchedAt) / 1000;
      let staleness: Staleness = 'fresh';
      if (ageSeconds > 60) staleness = 'expired';
      else if (ageSeconds > 30) staleness = 'critical';
      else if (ageSeconds > 5) staleness = 'delayed';

      if (staleness === 'fresh') {
        return { ...cached, staleness };
      }
      
      if (ageSeconds < CACHE_STALE_TTL) {
        // Stale-While-Revalidate: Return stale immediately, trigger background fetch
        this.fetchAndCacheQuote(symbol).catch(() => {});
        return { ...cached, staleness };
      }
    }

    // 2. Coalescing: If a fetch is already in flight, await it
    let pending = this.pendingQuotes.get(symbol);
    if (pending) {
      return pending;
    }

    // 3. Fetch from Provider
    pending = this.fetchAndCacheQuote(symbol);
    this.pendingQuotes.set(symbol, pending);

    try {
      return await pending;
    } finally {
      this.pendingQuotes.delete(symbol);
    }
  }

  private async fetchAndCacheQuote(symbol: string): Promise<ResilientStockQuote> {
    try {
      const quote = await this.provider.getQuote(symbol);
      const cacheData = { ...quote, fetchedAt: Date.now() };
      // Store in redis for the full stale window length
      this.redis.setJson(`${REDIS_PREFIX}quote:${symbol}`, cacheData, CACHE_STALE_TTL).catch(() => {});
      return { ...quote, staleness: 'fresh' as Staleness };
    } catch (error) {
      this.logger.warn(`Failed to fetch and cache quote for ${symbol}`);
      throw error;
    }
  }

  /**
   * Get quotes for multiple symbols. Used by:
   * - Portfolio value calculation
   * - Watchlist price updates
   * - WebSocket price broadcaster
   *
   * Checks Redis cache per-symbol, fetches misses in bulk.
   */
  async getBulkQuotes(symbols: string[]): Promise<Map<string, ResilientStockQuote>> {
    const results = new Map<string, ResilientStockQuote>();
    const misses: string[] = [];

    // Check cache for each symbol
    for (const symbol of symbols) {
      const cached = await this.redis.getJson<ResilientStockQuote & { fetchedAt: number }>(
        `${REDIS_PREFIX}quote:${symbol}`,
      );
      if (cached) {
        const ageSeconds = (Date.now() - cached.fetchedAt) / 1000;
        let staleness: Staleness = 'fresh';
        if (ageSeconds > 60) staleness = 'expired';
        else if (ageSeconds > 30) staleness = 'critical';
        else if (ageSeconds > 5) staleness = 'delayed';

        if (staleness === 'fresh') {
          results.set(symbol, { ...cached, staleness });
        } else if (ageSeconds < CACHE_STALE_TTL) {
          results.set(symbol, { ...cached, staleness });
          misses.push(symbol); // Needs background refresh
        } else {
          misses.push(symbol); // Too old, blocking fetch needed
        }
      } else {
        misses.push(symbol);
      }
    }

    // Fetch cache misses and background refreshes
    // We don't coalesce bulk requests perfectly here, but we could individually check pendingQuotes.
    // For simplicity, let's just fetch them via provider manager.
    if (misses.length > 0) {
      try {
        const fetched = await this.provider.getBulkQuotes(misses);
        for (const [symbol, quote] of fetched) {
          results.set(symbol, { ...quote, staleness: 'fresh' as Staleness });
          const cacheData = { ...quote, fetchedAt: Date.now() };
          this.redis
            .setJson(`${REDIS_PREFIX}quote:${symbol}`, cacheData, CACHE_STALE_TTL)
            .catch(() => {});
        }
      } catch (error) {
        this.logger.warn(`getBulkQuotes failed for ${misses.length} symbols.`);
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
    if (!query || query.trim().length === 0) return [];
    const q = query.trim();
    const qUpper = q.toUpperCase();

    // Run three priority tiers in parallel, merge and deduplicate
    const [exactSymbol, prefixSymbol, nameContains] = await Promise.all([
      // Tier 1: exact symbol match
      this.prisma.marketSymbol.findMany({
        where: { isActive: true, symbol: { equals: qUpper } },
        take: 3,
        select: { id: true, symbol: true, companyName: true, exchange: true, instrumentType: true, sector: true },
      }),
      // Tier 2: prefix symbol match
      this.prisma.marketSymbol.findMany({
        where: { isActive: true, symbol: { startsWith: qUpper } },
        take: limit,
        orderBy: { symbol: 'asc' },
        select: { id: true, symbol: true, companyName: true, exchange: true, instrumentType: true, sector: true },
      }),
      // Tier 3: company name contains query
      this.prisma.marketSymbol.findMany({
        where: { isActive: true, companyName: { contains: q, mode: 'insensitive' } },
        take: limit,
        orderBy: { symbol: 'asc' },
        select: { id: true, symbol: true, companyName: true, exchange: true, instrumentType: true, sector: true },
      }),
    ]);

    // Merge with deduplication, preserving priority order
    const seen = new Set<string>();
    const merged: typeof exactSymbol = [];
    for (const row of [...exactSymbol, ...prefixSymbol, ...nameContains]) {
      if (!seen.has(row.id)) {
        seen.add(row.id);
        merged.push(row);
      }
    }

    return merged.slice(0, limit);
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
  async getTrending(limit = 10): Promise<ResilientStockQuote[]> {
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
