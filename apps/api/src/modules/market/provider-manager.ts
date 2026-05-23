import { Injectable } from '@nestjs/common';
import { MarketDataProvider, StockQuote, OHLCVBar } from './market-data.provider';
import { PlatformLogger } from '../../common/logger/logger.service';
import { MetricsAggregatorService } from '../../common/logger/metrics.service';
import { PlatformEvent, MetricEvent } from '@tradesim/shared';
import type { Staleness } from '@tradesim/shared';

interface ProviderRegistration {
  provider: MarketDataProvider;
  name: string;
  isMock: boolean;
  failures: number;
  disabledUntil: number;
}

const CIRCUIT_BREAKER_TRIP_COUNT = 3;
const CIRCUIT_BREAKER_COOLOFF_MS = 5 * 60 * 1000; // 5 minutes

export class MarketDataUnavailableException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MarketDataUnavailableException';
  }
}

/**
 * Enhanced Quote payload with resilience metadata.
 */
export interface ResilientStockQuote extends StockQuote {
  provider: string;
  isMock: boolean;
  staleness?: Staleness; // Added by caching layer later
}

@Injectable()
export class ProviderManager {
  private readonly providers: ProviderRegistration[] = [];
  
  constructor(
    private readonly logger: PlatformLogger,
    private readonly metrics: MetricsAggregatorService,
  ) {
    this.logger.setContext(ProviderManager.name);
  }

  registerProvider(provider: MarketDataProvider, name: string, isMock: boolean) {
    this.providers.push({
      provider,
      name,
      isMock,
      failures: 0,
      disabledUntil: 0,
    });
    this.logger.log(`Registered market data provider: ${name} (Mock: ${isMock})`);
  }

  private getActiveProviders(): ProviderRegistration[] {
    const now = Date.now();
    return this.providers.filter(p => {
      if (p.disabledUntil > now) {
        return false;
      }
      return true;
    });
  }

  private handleFailure(p: ProviderRegistration, error: any) {
    p.failures += 1;
    if (p.failures >= CIRCUIT_BREAKER_TRIP_COUNT) {
      p.disabledUntil = Date.now() + CIRCUIT_BREAKER_COOLOFF_MS;
      this.logger.error({
        eventType: PlatformEvent.MARKET_PROVIDER_TRIPPED,
        message: `Circuit breaker tripped for provider ${p.name}. Disabled for ${CIRCUIT_BREAKER_COOLOFF_MS / 1000}s.`,
        metadata: { provider: p.name, error: error.message }
      });
    } else {
      this.logger.warn({
        eventType: PlatformEvent.MARKET_DATA_FETCH_FAILED,
        message: `Provider ${p.name} failed (${p.failures}/${CIRCUIT_BREAKER_TRIP_COUNT}): ${error.message}`,
        metadata: { provider: p.name, error: error.message }
      });
    }
  }

  private handleSuccess(p: ProviderRegistration, durationMs: number) {
    p.failures = 0;
    if (durationMs > 1000) {
      this.logger.warn({
        eventType: PlatformEvent.MARKET_PROVIDER_LATENCY_SPIKE,
        message: `Provider ${p.name} is slow (${durationMs}ms)`,
        metadata: { provider: p.name, durationMs }
      });
    }
  }

  async getQuote(symbol: string): Promise<ResilientStockQuote> {
    const active = this.getActiveProviders();
    if (active.length === 0) {
      throw new MarketDataUnavailableException('All market data providers are down.');
    }

    let lastError: any = null;

    for (const p of active) {
      // Mock provider should only activate if all other providers failed
      // (Unless it's the only one active due to dev config)
      const hasRealProvidersActive = active.some(x => !x.isMock);
      if (p.isMock && hasRealProvidersActive) {
        continue;
      }

      const start = Date.now();
      try {
        // Enforce timeout standard (e.g. 5 seconds)
        const quote = await Promise.race([
          p.provider.getQuote(symbol),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
        ]);

        const durationMs = Date.now() - start;
        this.handleSuccess(p, durationMs);
        
        return {
          ...quote,
          provider: p.name,
          isMock: p.isMock,
        };
      } catch (error) {
        lastError = error;
        this.handleFailure(p, error);
      }
    }

    // If we get here, all attempted providers failed
    // Wait, did we skip mock? Let's explicitly try mock if real failed
    const mockProvider = active.find(x => x.isMock);
    if (mockProvider && mockProvider.disabledUntil <= Date.now()) {
      try {
        const quote = await mockProvider.provider.getQuote(symbol);
        
        this.logger.warn({
          eventType: PlatformEvent.MARKET_PROVIDER_MOCK_ACTIVATED,
          message: 'Activated mock provider for single quote fallback',
          metadata: { symbol, fallbackProvider: mockProvider.name }
        });
        this.metrics.increment(MetricEvent.METRIC_PROVIDER_FAILOVER_COUNT);

        return {
          ...quote,
          provider: mockProvider.name,
          isMock: true,
        };
      } catch (mockError) {
        throw new MarketDataUnavailableException('All providers including Mock failed.');
      }
    }

    throw new MarketDataUnavailableException(`All providers failed. Last error: ${lastError?.message}`);
  }

  async getBulkQuotes(symbols: string[]): Promise<Map<string, ResilientStockQuote>> {
    const active = this.getActiveProviders();
    if (active.length === 0) {
      throw new MarketDataUnavailableException('All market data providers are down.');
    }

    for (const p of active) {
      const hasRealProvidersActive = active.some(x => !x.isMock);
      if (p.isMock && hasRealProvidersActive) {
        continue;
      }

      const start = Date.now();
      try {
        const results = await Promise.race([
          p.provider.getBulkQuotes(symbols),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000))
        ]);

        const durationMs = Date.now() - start;
        this.handleSuccess(p, durationMs);
        
        const enhancedResults = new Map<string, ResilientStockQuote>();
        for (const [sym, quote] of results.entries()) {
          enhancedResults.set(sym, {
            ...quote,
            provider: p.name,
            isMock: p.isMock,
          });
        }
        return enhancedResults;
      } catch (error) {
        this.handleFailure(p, error);
      }
    }

    const mockProvider = active.find(x => x.isMock);
    if (mockProvider && mockProvider.disabledUntil <= Date.now()) {
      const results = await mockProvider.provider.getBulkQuotes(symbols);
      
      this.logger.warn({
        eventType: PlatformEvent.MARKET_PROVIDER_FAILOVER,
        message: `Failed over to mock provider for ${symbols.length} symbols`,
        metadata: { fallbackProvider: mockProvider.name, symbolCount: symbols.length }
      });
      this.metrics.increment(MetricEvent.METRIC_PROVIDER_FAILOVER_COUNT);

      const enhancedResults = new Map<string, ResilientStockQuote>();
      for (const [sym, quote] of results.entries()) {
        enhancedResults.set(sym, {
          ...quote,
          provider: mockProvider.name,
          isMock: true,
        });
      }
      return enhancedResults;
    }

    return new Map();
  }

  async getOHLCV(symbol: string, range?: string): Promise<OHLCVBar[]> {
    const active = this.getActiveProviders();
    
    for (const p of active) {
      const hasRealProvidersActive = active.some(x => !x.isMock);
      if (p.isMock && hasRealProvidersActive) {
        continue;
      }

      try {
        return await p.provider.getOHLCV(symbol, range);
      } catch (error) {
        this.handleFailure(p, error);
      }
    }

    const mockProvider = active.find(x => x.isMock);
    if (mockProvider && mockProvider.disabledUntil <= Date.now()) {
       return await mockProvider.provider.getOHLCV(symbol, range);
    }
    
    return [];
  }
}
