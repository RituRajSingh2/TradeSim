import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Server } from 'socket.io';
import { MarketService } from '../market/market.service';
import { SubscriptionManager } from './subscription-manager';
import type { ResilientStockQuote } from '../market/provider-manager';
import { WS_EVENTS } from '@tradesim/shared';

// ============================================================
// Price Broadcaster — Polls prices & broadcasts to subscribers
//
// Implements:
//   - Per-symbol polling (only active symbols)
//   - Delta-based payloads (only changed prices)
//   - Batched emission (single message per tier interval)
//   - Timer lifecycle management (no orphaned intervals)
// ============================================================

const POLL_INTERVAL_MS = 5000; // 5s — matches Yahoo data resolution
const BROADCAST_INTERVAL_MS = 250; // 250ms — 4fps flush windows

@Injectable()
export class PriceBroadcaster implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PriceBroadcaster.name);

  /** Server instance — set by the WebSocket gateway after init */
  private server: Server | null = null;

  /** Symbol → latest quote (in-memory cache) */
  private readonly latestQuotes = new Map<string, ResilientStockQuote>();

  /** Symbol → last broadcasted cache key (timestamp:staleness) to prevent duplicate emissions */
  private readonly lastBroadcastedQuotes = new Map<string, string>();

  /** Client → last-sent quote per symbol (for delta computation) */
  private readonly lastSentSnapshots = new Map<
    string,
    Map<string, { ltp: number; timestamp: number; staleness?: string }>
  >();

  /** Central poll timer — fetches ALL active symbols every 5s */
  private pollTimer: NodeJS.Timeout | null = null;

  /** Broadcast timer — emits to clients every 250ms */
  private broadcastTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly marketService: MarketService,
    private readonly subscriptions: SubscriptionManager,
  ) {}

  onModuleInit() {
    // Register subscription lifecycle callbacks
    this.subscriptions.setCallbacks(
      (symbol) => this.onSymbolActivated(symbol),
      (symbol) => this.onSymbolDeactivated(symbol),
    );
  }

  /**
   * Set the Socket.IO server instance. Called by the gateway.
   */
  setServer(server: Server) {
    this.server = server;
    // Don't start broadcast loop here — wait for first subscription
  }

  /**
   * Called when a symbol gets its first subscriber.
   * Starts the central poll loop if not already running.
   */
  private onSymbolActivated(_symbol: string) {
    if (!this.pollTimer) {
      this.startPollLoop();
    }
    if (!this.broadcastTimer && this.server) {
      this.startBroadcastLoop();
    }
  }

  /**
   * Called when a symbol loses its last subscriber.
   * Cleans up the cached quote. Stops poll loop if no symbols left.
   */
  private onSymbolDeactivated(symbol: string) {
    this.latestQuotes.delete(symbol);

    if (this.subscriptions.getActiveSymbols().length === 0) {
      if (this.pollTimer) {
        clearInterval(this.pollTimer);
        this.pollTimer = null;
        this.logger.debug('Poll loop stopped — no active symbols');
      }
      if (this.broadcastTimer) {
        clearInterval(this.broadcastTimer);
        this.broadcastTimer = null;
        this.logger.debug('Broadcast loop stopped — no active symbols');
      }
    }
  }

  /**
   * Central poll loop — fetches all active symbols in bulk every 5s.
   */
  private startPollLoop() {
    this.logger.log('📡 Price poll loop started');

    // Immediate first fetch
    this.pollActiveSymbols().catch(() => {});

    this.pollTimer = setInterval(() => {
      this.pollActiveSymbols().catch((err) => {
        this.logger.error(`Poll error: ${err.message}`);
      });
    }, POLL_INTERVAL_MS);
  }

  /**
   * Fetch quotes for all symbols that have at least one subscriber.
   * Wrapped in try-catch: if the provider fails, stale quotes are retained
   * rather than clearing everything. Clients see frozen (but not missing) prices.
   */
  private async pollActiveSymbols() {
    const symbols = this.subscriptions.getActiveSymbols();
    if (symbols.length === 0) return;

    try {
      const quotes = await this.marketService.getBulkQuotes(symbols);

      for (const [symbol, quote] of quotes) {
        this.latestQuotes.set(symbol, quote);
      }
    } catch (err) {
      this.logger.error(
        `Bulk quote fetch failed — retaining stale quotes: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  /**
   * Broadcast loop — emits price updates to subscribed clients every 1s.
   * Uses delta-based payloads to avoid re-sending unchanged prices.
   */
  private startBroadcastLoop() {
    this.broadcastTimer = setInterval(() => {
      if (!this.server) return;

      const activeSymbols = this.subscriptions.getActiveSymbols();

      for (const symbol of activeSymbols) {
        const quote = this.latestQuotes.get(symbol);
        if (!quote) continue;

        // DELTA CHECK: Only broadcast if quote or staleness has changed
        const lastEntry = this.lastBroadcastedQuotes.get(symbol);
        if (lastEntry === `${quote.timestamp}:${quote.staleness}`) continue;

        // Emit to the stock room using the shared event constant
        this.server.to(`stock:${symbol}`).emit(WS_EVENTS.STOCK_PRICE, {
          symbol: quote.symbol,
          ltp: quote.ltp,
          open: quote.open,
          high: quote.high,
          low: quote.low,
          close: quote.close,
          volume: quote.volume,
          change: quote.change,
          changePercent: quote.changePercent,
          timestamp: quote.timestamp,
          staleness: quote.staleness,
          isMock: quote.isMock,
        });

        // Track what we just sent
        this.lastBroadcastedQuotes.set(symbol, `${quote.timestamp}:${quote.staleness}`);
      }
    }, BROADCAST_INTERVAL_MS);
  }

  /**
   * Compute delta for a watchlist update.
   * Returns only symbols whose LTP changed since the last emit to this client.
   */
  computeWatchlistDelta(
    clientId: string,
    symbols: string[],
  ): {
    type: 'snapshot' | 'delta';
    prices: Array<{
      symbol: string;
      ltp: number;
      change: number;
      changePercent: number;
      staleness?: string;
      isMock?: boolean;
    }>;
  } {
    let lastSent = this.lastSentSnapshots.get(clientId);
    const isFirstSend = !lastSent;

    if (!lastSent) {
      lastSent = new Map();
      this.lastSentSnapshots.set(clientId, lastSent);
    }

    const changed: Array<{
      symbol: string;
      ltp: number;
      change: number;
      changePercent: number;
      staleness?: string;
      isMock?: boolean;
    }> = [];

    for (const symbol of symbols) {
      const quote = this.latestQuotes.get(symbol);
      if (!quote) continue;

      const prev = lastSent.get(symbol);
      if (!prev || prev.ltp !== quote.ltp || prev.staleness !== quote.staleness) {
        changed.push({
          symbol: quote.symbol,
          ltp: quote.ltp,
          change: quote.change,
          changePercent: quote.changePercent,
          staleness: quote.staleness,
          isMock: quote.isMock,
        });

        // Update last-sent
        lastSent.set(symbol, { ltp: quote.ltp, timestamp: quote.timestamp, staleness: quote.staleness });
      }
    }

    return {
      type: isFirstSend ? 'snapshot' : 'delta',
      prices: isFirstSend
        ? symbols
            .map((s) => this.latestQuotes.get(s))
            .filter(Boolean)
            .map((q) => ({
              symbol: q!.symbol,
              ltp: q!.ltp,
              change: q!.change,
              changePercent: q!.changePercent,
              staleness: q!.staleness,
              isMock: q!.isMock,
            }))
        : changed,
    };
  }

  /**
   * Clean up a client's delta snapshot cache.
   */
  clearClientCache(clientId: string) {
    this.lastSentSnapshots.delete(clientId);
  }

  onModuleDestroy() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.broadcastTimer) {
      clearInterval(this.broadcastTimer);
      this.broadcastTimer = null;
    }
    this.latestQuotes.clear();
    this.lastSentSnapshots.clear();
    this.logger.log('Price broadcaster cleaned up');
  }
}
