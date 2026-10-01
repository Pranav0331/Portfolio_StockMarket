import { describe, it, expect } from 'vitest';
import {
  sortCandlesChronologically,
  calculateSMA,
  calculateEMA,
  calculateRSI,
  calculateMACD,
  computeAllTechnicalAnalysis
} from './technical-analysis.utils';
import { Candle } from '../models/market.model';

describe('Technical Analysis Utilities', () => {

  // Deterministic helper to create candle fixtures
  function makeCandles(prices: number[], startTimestamp: number = 1000, step: number = 60): Candle[] {
    return prices.map((close, i) => ({
      timestamp: startTimestamp + i * step,
      datetime: `2026-10-01 10:${i < 10 ? '0' + i : i}:00`,
      open: close - 0.5,
      high: close + 1.0,
      low: close - 1.0,
      close: close,
      volume: 1000 + i * 10
    }));
  }

  describe('1. Chronological Data Ordering', () => {
    it('should sort out-of-order candles chronologically', () => {
      const unsorted: Candle[] = [
        { timestamp: 1030, datetime: '', open: 10, high: 12, low: 9, close: 11, volume: 100 },
        { timestamp: 1010, datetime: '', open: 8, high: 10, low: 7, close: 9, volume: 100 },
        { timestamp: 1040, datetime: '', open: 11, high: 13, low: 10, close: 12, volume: 100 },
        { timestamp: 1020, datetime: '', open: 9, high: 11, low: 8, close: 10, volume: 100 }
      ];

      const sorted = sortCandlesChronologically(unsorted);
      expect(sorted.map(c => c.timestamp)).toEqual([1010, 1020, 1030, 1040]);
      expect(sorted.map(c => c.close)).toEqual([9, 10, 11, 12]);
    });

    it('should deduplicate candles with duplicate timestamps', () => {
      const duplicates: Candle[] = [
        { timestamp: 1010, datetime: '', open: 8, high: 10, low: 7, close: 9, volume: 100 },
        { timestamp: 1010, datetime: '', open: 8, high: 10, low: 7, close: 9, volume: 100 },
        { timestamp: 1020, datetime: '', open: 9, high: 11, low: 8, close: 10, volume: 100 }
      ];

      const result = sortCandlesChronologically(duplicates);
      expect(result.length).toBe(2);
      expect(result.map(c => c.timestamp)).toEqual([1010, 1020]);
    });

    it('should handle empty or null array safely', () => {
      expect(sortCandlesChronologically([])).toEqual([]);
      expect(sortCandlesChronologically(null as any)).toEqual([]);
    });
  });

  describe('2. Simple Moving Average (SMA)', () => {
    it('should calculate SMA correctly against known deterministic fixture', () => {
      // 5 values: 10, 20, 30, 40, 50 with period 3
      // Window 1: (10 + 20 + 30) / 3 = 20
      // Window 2: (20 + 30 + 40) / 3 = 30
      // Window 3: (30 + 40 + 50) / 3 = 40
      const candles = makeCandles([10, 20, 30, 40, 50]);
      const res = calculateSMA(candles, 3);

      expect(res.isSufficient).toBe(true);
      expect(res.data.length).toBe(3);
      expect(res.data[0].value).toBe(20);
      expect(res.data[1].value).toBe(30);
      expect(res.data[2].value).toBe(40);
      expect(res.latestValue).toBe(40);
    });

    it('should report insufficient data when candles are fewer than period', () => {
      const candles = makeCandles([10, 20]);
      const res = calculateSMA(candles, 5);

      expect(res.isSufficient).toBe(false);
      expect(res.data).toEqual([]);
      expect(res.latestValue).toBeNull();
      expect(res.message).toBe('Insufficient data');
    });
  });

  describe('3. Exponential Moving Average (EMA)', () => {
    it('should calculate EMA correctly with initial SMA and multiplier k = 2 / (N + 1)', () => {
      // 5 values: [10, 20, 30, 40, 50], period 3
      // k = 2 / (3 + 1) = 0.5
      // Initial EMA at index 2 (period 3): (10 + 20 + 30) / 3 = 20
      // Index 3 (price 40): 40 * 0.5 + 20 * 0.5 = 30
      // Index 4 (price 50): 50 * 0.5 + 30 * 0.5 = 40
      const candles = makeCandles([10, 20, 30, 40, 50]);
      const res = calculateEMA(candles, 3);

      expect(res.isSufficient).toBe(true);
      expect(res.data.length).toBe(3);
      expect(res.data[0].value).toBe(20);
      expect(res.data[1].value).toBe(30);
      expect(res.data[2].value).toBe(40);
      expect(res.latestValue).toBe(40);
    });

    it('should report insufficient data when candles are fewer than period', () => {
      const candles = makeCandles([10, 20]);
      const res = calculateEMA(candles, 20);

      expect(res.isSufficient).toBe(false);
      expect(res.data).toEqual([]);
      expect(res.latestValue).toBeNull();
      expect(res.message).toBe('Insufficient data');
    });
  });

  describe('4. Relative Strength Index (RSI)', () => {
    it('should calculate RSI with 14-period Wilder smoothing', () => {
      // 16 constant increasing prices: always gain, 0 loss => RSI should be 100
      const prices = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25];
      const candles = makeCandles(prices);
      const res = calculateRSI(candles, 14);

      expect(res.isSufficient).toBe(true);
      expect(res.data.length).toBe(2); // 16 candles - 14 period = 2 points
      expect(res.latestValue).toBe(100);
    });

    it('should calculate correct RSI for alternating price movement', () => {
      // 15 prices alternating between 100 and 105
      const prices = [100, 105, 100, 105, 100, 105, 100, 105, 100, 105, 100, 105, 100, 105, 100];
      const candles = makeCandles(prices);
      const res = calculateRSI(candles, 14);

      expect(res.isSufficient).toBe(true);
      expect(res.data.length).toBe(1);
      // Equal gains and equal losses => RS = 1 => RSI = 50
      expect(res.latestValue).toBe(50);
    });

    it('should report insufficient data when candles are fewer than period + 1', () => {
      const candles = makeCandles([10, 12, 14]);
      const res = calculateRSI(candles, 14);

      expect(res.isSufficient).toBe(false);
      expect(res.latestValue).toBeNull();
      expect(res.message).toBe('Insufficient data');
    });
  });

  describe('5. MACD, Signal Line, and Histogram', () => {
    it('should calculate MACD, Signal Line, and Histogram when sufficient data is present', () => {
      // Create 50 candles with an upward trend
      const prices = Array.from({ length: 50 }, (_, i) => 100 + i * 2);
      const candles = makeCandles(prices);

      const res = calculateMACD(candles, 12, 26, 9);

      expect(res.isSufficient).toBe(true);
      expect(res.macdLine.length).toBeGreaterThan(0);
      expect(res.signalLine.length).toBeGreaterThan(0);
      expect(res.histogram.length).toBeGreaterThan(0);
      expect(res.latestMACD).not.toBeNull();
      expect(res.latestSignal).not.toBeNull();
      expect(res.latestHistogram).not.toBeNull();
      // In steady uptrend, MACD > 0
      expect(res.latestMACD!).toBeGreaterThan(0);
    });

    it('should report insufficient data when candles are fewer than slowPeriod (26)', () => {
      const candles = makeCandles(Array.from({ length: 20 }, (_, i) => 100 + i));
      const res = calculateMACD(candles, 12, 26, 9);

      expect(res.isSufficient).toBe(false);
      expect(res.macdLine).toEqual([]);
      expect(res.signalLine).toEqual([]);
      expect(res.histogram).toEqual([]);
      expect(res.latestMACD).toBeNull();
      expect(res.message).toBe('Insufficient data');
    });
  });

  describe('6. Comprehensive Technical Summary', () => {
    it('should compile full technical analysis summary', () => {
      const prices = Array.from({ length: 60 }, (_, i) => 2500 + i * 5);
      const candles = makeCandles(prices);

      const summary = computeAllTechnicalAnalysis('RELIANCE', candles, '1D', '5min', 'Upstox');

      expect(summary.symbol).toBe('RELIANCE');
      expect(summary.candleCount).toBe(60);
      expect(summary.lastPrice).toBe(2795); // 2500 + 59 * 5
      expect(summary.provider).toBe('Upstox');
      expect(summary.sma20.isSufficient).toBe(true);
      expect(summary.sma50.isSufficient).toBe(true);
      expect(summary.ema20.isSufficient).toBe(true);
      expect(summary.ema50.isSufficient).toBe(true);
      expect(summary.rsi14.isSufficient).toBe(true);
      expect(summary.macd.isSufficient).toBe(true);
    });
  });
});
