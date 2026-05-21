import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';
import type { ChartTimeframe } from '@tradesim/shared';
import type { OHLCVBar } from './market-data.provider';

const HISTORY_PREFIX = 'market:history';

@Injectable()
export class HistoryService {
  private readonly logger = new Logger(HistoryService.name);

  constructor(private readonly redis: RedisService) {}

  /**
   * Save candles to a Redis Sorted Set.
   * Score = timestamp
   * Value = Compact JSON array string [t, o, h, l, c, v]
   */
  async saveCandles(symbol: string, timeframe: ChartTimeframe, candles: OHLCVBar[]): Promise<void> {
    if (candles.length === 0) return;

    const key = `${HISTORY_PREFIX}:${symbol}:${timeframe}`;
    const pipeline = this.redis.getClient().pipeline();

    for (const candle of candles) {
      // Serialize to compact array to reduce memory
      const compactArray = [candle.time, candle.open, candle.high, candle.low, candle.close, candle.volume];
      pipeline.zadd(key, candle.time, JSON.stringify(compactArray));
    }

    const nowSecs = Math.floor(Date.now() / 1000);

    // Active ZSET pruning + Key TTLs to prevent memory leaks
    if (timeframe === '10s' || timeframe === '30s') {
      // Strictly drop candles older than 24h from the sorted set
      pipeline.zremrangebyscore(key, '-inf', nowSecs - 86400);
      // Safety net: entire key expires if trading halts for 24h
      pipeline.expire(key, 86400); 
    } else if (timeframe === '1m' || timeframe === '5m' || timeframe === '15m') {
      // Strictly drop candles older than 7 days
      pipeline.zremrangebyscore(key, '-inf', nowSecs - (86400 * 7));
      pipeline.expire(key, 86400 * 7);
    } else {
      // 1D/1W candles are small enough that dropping individual old candles isn't as critical,
      // but we maintain a 5-year overall TTL.
      pipeline.expire(key, 86400 * 365 * 5); 
    }

    await pipeline.exec();
  }

  /**
   * Get raw candles from Redis within a timeframe.
   */
  private async getRawCandles(
    symbol: string, 
    timeframe: ChartTimeframe, 
    toTime: number, 
    limit: number
  ): Promise<OHLCVBar[]> {
    const key = `${HISTORY_PREFIX}:${symbol}:${timeframe}`;
    
    // ZREVRANGEBYSCORE key max min LIMIT offset count
    // max = toTime, min = -inf
    const rawData = await this.redis.getClient().zrevrangebyscore(
      key, 
      toTime, 
      '-inf', 
      'LIMIT', 
      0, 
      limit
    );

    // ZREV returns newest first, so we reverse to make it chronological
    const candles = rawData.map(str => {
      const parsed = JSON.parse(str);
      // Support backward compatibility if some old objects exist
      if (Array.isArray(parsed)) {
        return {
          time: parsed[0],
          open: parsed[1],
          high: parsed[2],
          low: parsed[3],
          close: parsed[4],
          volume: parsed[5],
        };
      }
      return parsed as OHLCVBar;
    }).reverse();
    
    return candles;
  }

  /**
   * Main API for fetching historical data with aggregation support.
   */
  async getHistoricalData(
    symbol: string,
    timeframe: ChartTimeframe,
    toTime: number,
    limit: number
  ): Promise<OHLCVBar[]> {
    // Determine the base timeframe to query
    let baseTimeframe: ChartTimeframe = timeframe;
    let aggregateFactor = 1;

    // We store 10s, 1m, and 1D natively. We aggregate the rest on the fly.
    switch (timeframe) {
      case '30s': baseTimeframe = '10s'; aggregateFactor = 3; break;
      case '5m':  baseTimeframe = '1m'; aggregateFactor = 5; break;
      case '15m': baseTimeframe = '1m'; aggregateFactor = 15; break;
      case '1h':  baseTimeframe = '1m'; aggregateFactor = 60; break;
      case '1W':  baseTimeframe = '1D'; aggregateFactor = 5; break; // Approximating 5 trading days
      case '1M':  baseTimeframe = '1D'; aggregateFactor = 22; break; // Approximating 22 trading days
      case '1Y':  baseTimeframe = '1D'; aggregateFactor = 252; break; // Approximating 252 trading days
    }

    // 10s/30s enforce session limits (don't return data older than 24h)
    if (timeframe === '10s' || timeframe === '30s') {
      const now = Math.floor(Date.now() / 1000);
      if (now - toTime > 86400) {
         return []; // Block pagination past 24 hours
      }
    }

    const fetchLimit = limit * aggregateFactor;
    const rawCandles = await this.getRawCandles(symbol, baseTimeframe, toTime, fetchLimit);

    if (aggregateFactor === 1 || rawCandles.length === 0) {
      return rawCandles;
    }

    return this.aggregateCandles(rawCandles, aggregateFactor);
  }

  /**
   * Aggregate smaller candles into larger ones.
   */
  private aggregateCandles(candles: OHLCVBar[], factor: number): OHLCVBar[] {
    const result: OHLCVBar[] = [];
    
    // We group from the oldest to newest
    for (let i = 0; i < candles.length; i += factor) {
      const chunk = candles.slice(i, i + factor);
      if (chunk.length === 0) continue;

      const first = chunk[0];
      const last = chunk[chunk.length - 1];
      
      const aggregated: OHLCVBar = {
        time: last.time, // The end time of the aggregation window
        open: first.open,
        high: Math.max(...chunk.map(c => c.high)),
        low: Math.min(...chunk.map(c => c.low)),
        close: last.close,
        volume: chunk.reduce((sum, c) => sum + c.volume, 0),
      };
      
      result.push(aggregated);
    }

    return result;
  }
}
