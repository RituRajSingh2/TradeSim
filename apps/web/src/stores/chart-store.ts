import { create } from 'zustand';
import type { ChartTimeframe } from '@tradesim/shared';

// We define our own candle interface mapped from the API payload
export interface ChartCandle {
  time: number; // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ChartChunk {
  index: number;
  startTime: number;
  endTime: number;
  candles: ChartCandle[];
}

// A ChartKey is `${symbol}_${timeframe}`
type ChartKey = string;

export interface ChartState {
  // Map of [symbol_timeframe] -> map of [chunkIndex] -> Chunk
  chunks: Record<ChartKey, Record<number, ChartChunk>>;
  
  // Track the oldest chunk index loaded for pagination
  oldestLoadedIndex: Record<ChartKey, number>;
  
  // Active chart selection
  activeSymbol: string;
  activeTimeframe: ChartTimeframe;

  // Track the last 3 active ChartKeys for LRU eviction
  lruKeys: string[];

  // Actions
  setActiveChart: (symbol: string, timeframe: ChartTimeframe) => void;
  addChunk: (symbol: string, timeframe: ChartTimeframe, chunkIndex: number, candles: ChartCandle[]) => void;
  appendRealtimeCandle: (symbol: string, timeframe: ChartTimeframe, candle: ChartCandle, isUpdate: boolean) => void;
  getFlattenedData: (symbol: string, timeframe: ChartTimeframe) => ChartCandle[];
  hasLoadedSessionMax: (symbol: string, timeframe: ChartTimeframe) => boolean;
}

const MAX_LRU_KEYS = 3;
const CHUNK_SIZE = 500; // Candles per chunk

export const useChartStore = create<ChartState>((set, get) => ({
  chunks: {},
  oldestLoadedIndex: {},
  activeSymbol: 'RELIANCE', // Default
  activeTimeframe: '1m',
  lruKeys: [],

  setActiveChart: (symbol, timeframe) => {
    set((state) => {
      const key = `${symbol}_${timeframe}`;
      let newLru = state.lruKeys.filter((k) => k !== key);
      newLru.unshift(key); // push to front

      const newChunks = { ...state.chunks };
      const newOldest = { ...state.oldestLoadedIndex };

      // LRU Eviction: delete keys that exceed our memory cap
      if (newLru.length > MAX_LRU_KEYS) {
        const evictedKey = newLru.pop();
        if (evictedKey) {
          delete newChunks[evictedKey];
          delete newOldest[evictedKey];
        }
      }

      return {
        activeSymbol: symbol,
        activeTimeframe: timeframe,
        lruKeys: newLru,
        chunks: newChunks,
        oldestLoadedIndex: newOldest,
      };
    });
  },

  addChunk: (symbol, timeframe, chunkIndex, candles) => {
    const key = `${symbol}_${timeframe}`;
    set((state) => {
      const currentMap = state.chunks[key] || {};
      const currentOldest = state.oldestLoadedIndex[key] ?? chunkIndex;

      return {
        chunks: {
          ...state.chunks,
          [key]: {
            ...currentMap,
            [chunkIndex]: {
              index: chunkIndex,
              startTime: candles[0]?.time ?? 0,
              endTime: candles[candles.length - 1]?.time ?? 0,
              candles,
            },
          },
        },
        oldestLoadedIndex: {
          ...state.oldestLoadedIndex,
          [key]: Math.min(currentOldest, chunkIndex),
        },
      };
    });
  },

  appendRealtimeCandle: (symbol, timeframe, candle, isUpdate) => {
    const key = `${symbol}_${timeframe}`;
    set((state) => {
      const currentMap = state.chunks[key];
      if (!currentMap) return state; // Ignore updates for uninitialized charts

      // Find the highest chunk index (the newest one)
      const chunkIndices = Object.keys(currentMap).map(Number).sort((a, b) => b - a);
      if (chunkIndices.length === 0) return state;

      const newestIndex = chunkIndices[0];
      const newestChunk = { ...currentMap[newestIndex] };
      const candles = [...newestChunk.candles];

      if (isUpdate && candles.length > 0) {
        // Update the last candle
        candles[candles.length - 1] = candle;
      } else {
        // Append new candle
        candles.push(candle);
        
        // If chunk gets too large, we could theoretically split it, but for realtime 
        // it's fine to just let the newest chunk grow slightly until reload.
      }

      newestChunk.candles = candles;
      newestChunk.endTime = candle.time;

      return {
        chunks: {
          ...state.chunks,
          [key]: {
            ...currentMap,
            [newestIndex]: newestChunk,
          },
        },
      };
    });
  },

  getFlattenedData: (symbol, timeframe) => {
    const key = `${symbol}_${timeframe}`;
    const currentMap = get().chunks[key];
    if (!currentMap) return [];

    // Sort chunks by index ascending
    const sortedIndices = Object.keys(currentMap).map(Number).sort((a, b) => a - b);
    
    const flattened: ChartCandle[] = [];
    for (const idx of sortedIndices) {
      flattened.push(...currentMap[idx].candles);
    }
    
    // De-duplicate just in case chunks overlap (e.g., boundaries)
    // Lightweight charts requires strictly increasing times
    const unique: ChartCandle[] = [];
    let lastTime = -1;
    
    for (const c of flattened) {
      if (c.time > lastTime) {
        unique.push(c);
        lastTime = c.time;
      } else if (c.time === lastTime) {
        // Overwrite with the latest data for that specific timestamp
        unique[unique.length - 1] = c;
      }
    }

    return unique;
  },

  hasLoadedSessionMax: (symbol, timeframe) => {
    // 10s and 30s are restricted to intraday session only.
    // If we've loaded enough chunks (e.g., 2 chunks = 1000 bars = ~2.7 hours at 10s), 
    // we block further backward pagination.
    if (timeframe === '10s' || timeframe === '30s') {
      const key = `${symbol}_${timeframe}`;
      const currentMap = get().chunks[key];
      if (!currentMap) return false;
      
      const chunkCount = Object.keys(currentMap).length;
      // Hard cap 10s/30s to 3 chunks (~1500 candles)
      return chunkCount >= 3; 
    }
    return false;
  }
}));
