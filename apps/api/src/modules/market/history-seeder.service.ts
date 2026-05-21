import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { HistoryService } from './history.service';
import type { OHLCVBar } from './market-data.provider';
import type { ChartTimeframe } from '@tradesim/shared';

@Injectable()
export class HistorySeederService implements OnModuleInit {
  private readonly logger = new Logger(HistorySeederService.name);

  // Common symbols to seed so the UI looks alive instantly
  private readonly SEED_SYMBOLS = ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY'];

  constructor(private readonly historyService: HistoryService) {}

  async onModuleInit() {
    this.logger.log('🌱 Starting Historical Data Seeder...');
    
    for (const symbol of this.SEED_SYMBOLS) {
      await this.seedSymbol(symbol);
    }
    
    this.logger.log('✅ Historical Data Seeding Complete.');
  }

  private async seedSymbol(symbol: string) {
    // We only seed if the redis doesn't have it, but for simplicity in dev,
    // we'll just aggressively overwrite/add to the ZSET (which handles duplicates naturally by timestamp).
    
    const now = Math.floor(Date.now() / 1000);
    const basePrice = symbol === 'RELIANCE' ? 2450 : symbol === 'TCS' ? 3800 : 1500;

    // 1. Seed 1D data for the last 1 year (365 candles)
    const dailyCandles = this.generateWalk(basePrice, now, 365, 86400, symbol.length, 0.02);
    await this.historyService.saveCandles(symbol, '1D', dailyCandles);

    // 2. Seed 1m data for the last 5 days (5 * 24 * 60 = 7200 candles)
    // To match TradingView perfectly, we end the 1m walk precisely at the last close of the 1D walk
    const lastDailyClose = dailyCandles[dailyCandles.length - 1].close;
    const minCandles = this.generateWalk(lastDailyClose, now, 7200, 60, symbol.length + 1, 0.002);
    await this.historyService.saveCandles(symbol, '1m', minCandles);

    // 3. Seed 10s data for the current session (last 6 hours = 2160 candles)
    const lastMinClose = minCandles[minCandles.length - 1].close;
    const secCandles = this.generateWalk(lastMinClose, now, 2160, 10, symbol.length + 2, 0.0005);
    await this.historyService.saveCandles(symbol, '10s', secCandles);

    this.logger.debug(`Seeded history for ${symbol}`);
  }

  /**
   * Generates a deterministic random walk.
   */
  private generateWalk(
    startPrice: number,
    endTime: number,
    count: number,
    intervalSeconds: number,
    seedOffset: number,
    volatility: number
  ): OHLCVBar[] {
    const bars: OHLCVBar[] = [];
    let currentPrice = startPrice;

    // We generate backwards, then reverse, so the last candle ends at startPrice
    for (let i = count; i >= 1; i--) {
      const time = endTime - (i * intervalSeconds);
      
      // Pseudo-random deterministic variation
      const seed = time / 10000 + seedOffset;
      const move = Math.sin(seed) * volatility + Math.cos(seed * 1.5) * (volatility / 2);
      
      const open = currentPrice;
      const close = +(open * (1 + move)).toFixed(2);
      const high = +Math.max(open, close, open * (1 + Math.abs(move) + volatility/4)).toFixed(2);
      const low = +Math.min(open, close, open * (1 - Math.abs(move) - volatility/4)).toFixed(2);
      
      bars.push({
        time,
        open,
        high,
        low,
        close,
        volume: Math.floor(1000 + Math.abs(Math.sin(seed)) * 50000),
      });

      currentPrice = close;
    }

    return bars;
  }
}
