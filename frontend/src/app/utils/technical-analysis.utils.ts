import { Candle } from '../models/market.model';

export interface TimeValuePoint {
  time: number; // Unix timestamp in seconds
  value: number;
}

export interface HistogramPoint {
  time: number;
  value: number;
  color?: string;
}

export interface IndicatorResult<T> {
  isSufficient: boolean;
  data: T[];
  latestValue: number | null;
  message?: string;
}

export interface MACDResult {
  isSufficient: boolean;
  macdLine: TimeValuePoint[];
  signalLine: TimeValuePoint[];
  histogram: HistogramPoint[];
  latestMACD: number | null;
  latestSignal: number | null;
  latestHistogram: number | null;
  message?: string;
}

export interface TechnicalSummary {
  symbol: string;
  interval: string;
  timeframe: string;
  candleCount: number;
  lastPrice: number | null;
  lastUpdated: string | null;
  provider: string;
  sma20: IndicatorResult<TimeValuePoint>;
  sma50: IndicatorResult<TimeValuePoint>;
  ema20: IndicatorResult<TimeValuePoint>;
  ema50: IndicatorResult<TimeValuePoint>;
  rsi14: IndicatorResult<TimeValuePoint>;
  macd: MACDResult;
}

/**
 * Ensures candles are strictly sorted chronologically (oldest to newest)
 * and deduplicated by timestamp.
 */
export function sortCandlesChronologically(candles: Candle[]): Candle[] {
  if (!candles || candles.length === 0) return [];
  const sorted = [...candles].sort((a, b) => a.timestamp - b.timestamp);
  
  // Deduplicate timestamps if necessary
  const unique: Candle[] = [];
  const seen = new Set<number>();
  for (const c of sorted) {
    if (!seen.has(c.timestamp)) {
      seen.add(c.timestamp);
      unique.push(c);
    }
  }
  return unique;
}

/**
 * Calculates Simple Moving Average (SMA).
 * Requires at least `period` candles.
 */
export function calculateSMA(candles: Candle[], period: number = 20): IndicatorResult<TimeValuePoint> {
  const sorted = sortCandlesChronologically(candles);
  if (sorted.length < period || period <= 0) {
    return {
      isSufficient: false,
      data: [],
      latestValue: null,
      message: 'Insufficient data'
    };
  }

  const data: TimeValuePoint[] = [];
  let sum = 0;

  for (let i = 0; i < period; i++) {
    sum += sorted[i].close;
  }
  data.push({
    time: sorted[period - 1].timestamp,
    value: Number((sum / period).toFixed(4))
  });

  for (let i = period; i < sorted.length; i++) {
    sum += sorted[i].close - sorted[i - period].close;
    data.push({
      time: sorted[i].timestamp,
      value: Number((sum / period).toFixed(4))
    });
  }

  const latest = data.length > 0 ? data[data.length - 1].value : null;
  return {
    isSufficient: true,
    data,
    latestValue: latest
  };
}

/**
 * Calculates Exponential Moving Average (EMA).
 * Multiplier k = 2 / (period + 1). Initial value is SMA of first `period` closes.
 */
export function calculateEMA(candles: Candle[], period: number = 20): IndicatorResult<TimeValuePoint> {
  const sorted = sortCandlesChronologically(candles);
  if (sorted.length < period || period <= 0) {
    return {
      isSufficient: false,
      data: [],
      latestValue: null,
      message: 'Insufficient data'
    };
  }

  const data: TimeValuePoint[] = [];
  const k = 2 / (period + 1);

  let initialSum = 0;
  for (let i = 0; i < period; i++) {
    initialSum += sorted[i].close;
  }
  let currentEma = initialSum / period;

  data.push({
    time: sorted[period - 1].timestamp,
    value: Number(currentEma.toFixed(4))
  });

  for (let i = period; i < sorted.length; i++) {
    currentEma = sorted[i].close * k + currentEma * (1 - k);
    data.push({
      time: sorted[i].timestamp,
      value: Number(currentEma.toFixed(4))
    });
  }

  const latest = data.length > 0 ? data[data.length - 1].value : null;
  return {
    isSufficient: true,
    data,
    latestValue: latest
  };
}

/**
 * Calculates Relative Strength Index (RSI) using Wilder's 14-period smoothing.
 * Requires at least `period + 1` candles.
 */
export function calculateRSI(candles: Candle[], period: number = 14): IndicatorResult<TimeValuePoint> {
  const sorted = sortCandlesChronologically(candles);
  if (sorted.length < period + 1 || period <= 0) {
    return {
      isSufficient: false,
      data: [],
      latestValue: null,
      message: 'Insufficient data'
    };
  }

  const data: TimeValuePoint[] = [];
  let gainSum = 0;
  let lossSum = 0;

  for (let i = 1; i <= period; i++) {
    const diff = sorted[i].close - sorted[i - 1].close;
    if (diff >= 0) gainSum += diff;
    else lossSum += Math.abs(diff);
  }

  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;

  let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  let rsi = avgLoss === 0 ? 100 : 100 - (100 / (1 + rs));

  data.push({
    time: sorted[period].timestamp,
    value: Number(rsi.toFixed(2))
  });

  for (let i = period + 1; i < sorted.length; i++) {
    const diff = sorted[i].close - sorted[i - 1].close;
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsi = avgLoss === 0 ? 100 : 100 - (100 / (1 + rs));

    data.push({
      time: sorted[i].timestamp,
      value: Number(rsi.toFixed(2))
    });
  }

  const latest = data.length > 0 ? data[data.length - 1].value : null;
  return {
    isSufficient: true,
    data,
    latestValue: latest
  };
}

/**
 * Calculates Moving Average Convergence Divergence (MACD).
 * Fast EMA (default 12) - Slow EMA (default 26)
 * Signal Line (default 9-period EMA of MACD Line)
 * Histogram (MACD Line - Signal Line)
 */
export function calculateMACD(
  candles: Candle[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): MACDResult {
  const sorted = sortCandlesChronologically(candles);
  // Need at least slowPeriod candles to compute first MACD point,
  // and slowPeriod + signalPeriod - 1 candles to compute first signal point.
  if (sorted.length < slowPeriod || slowPeriod <= fastPeriod || signalPeriod <= 0) {
    return {
      isSufficient: false,
      macdLine: [],
      signalLine: [],
      histogram: [],
      latestMACD: null,
      latestSignal: null,
      latestHistogram: null,
      message: 'Insufficient data'
    };
  }

  const fastResult = calculateEMA(sorted, fastPeriod);
  const slowResult = calculateEMA(sorted, slowPeriod);

  if (!fastResult.isSufficient || !slowResult.isSufficient) {
    return {
      isSufficient: false,
      macdLine: [],
      signalLine: [],
      histogram: [],
      latestMACD: null,
      latestSignal: null,
      latestHistogram: null,
      message: 'Insufficient data'
    };
  }

  const slowMap = new Map<number, number>();
  slowResult.data.forEach(pt => slowMap.set(pt.time, pt.value));

  const macdLine: TimeValuePoint[] = [];
  const macdCandles: Candle[] = [];

  fastResult.data.forEach(pt => {
    const slowVal = slowMap.get(pt.time);
    if (slowVal !== undefined) {
      const val = Number((pt.value - slowVal).toFixed(4));
      macdLine.push({ time: pt.time, value: val });
      macdCandles.push({
        timestamp: pt.time,
        datetime: '',
        open: val,
        high: val,
        low: val,
        close: val,
        volume: 0
      });
    }
  });

  if (macdLine.length < signalPeriod) {
    // We have MACD line points, but not enough for signal line yet
    return {
      isSufficient: false,
      macdLine,
      signalLine: [],
      histogram: [],
      latestMACD: macdLine.length > 0 ? macdLine[macdLine.length - 1].value : null,
      latestSignal: null,
      latestHistogram: null,
      message: 'Insufficient data for signal line'
    };
  }

  const signalResult = calculateEMA(macdCandles, signalPeriod);
  const signalLine: TimeValuePoint[] = signalResult.data;

  const signalMap = new Map<number, number>();
  signalLine.forEach(pt => signalMap.set(pt.time, pt.value));

  const histogram: HistogramPoint[] = [];
  macdLine.forEach(m => {
    const s = signalMap.get(m.time);
    if (s !== undefined) {
      const diff = Number((m.value - s).toFixed(4));
      histogram.push({
        time: m.time,
        value: diff,
        color: diff >= 0 ? '#10b981' : '#ef4444'
      });
    }
  });

  const latestMACD = macdLine.length > 0 ? macdLine[macdLine.length - 1].value : null;
  const latestSignal = signalLine.length > 0 ? signalLine[signalLine.length - 1].value : null;
  const latestHistogram = histogram.length > 0 ? histogram[histogram.length - 1].value : null;

  return {
    isSufficient: true,
    macdLine,
    signalLine,
    histogram,
    latestMACD,
    latestSignal,
    latestHistogram
  };
}

/**
 * Computes all technical analysis indicators for a set of candles.
 */
export function computeAllTechnicalAnalysis(
  symbol: string,
  candles: Candle[],
  timeframe: string = '1D',
  interval: string = '5min',
  provider: string = 'Market Data'
): TechnicalSummary {
  const sorted = sortCandlesChronologically(candles);
  const candleCount = sorted.length;
  const lastPrice = candleCount > 0 ? sorted[candleCount - 1].close : null;
  const lastUpdated = candleCount > 0 ? sorted[candleCount - 1].datetime || new Date(sorted[candleCount - 1].timestamp * 1000).toISOString() : null;

  return {
    symbol,
    interval,
    timeframe,
    candleCount,
    lastPrice,
    lastUpdated,
    provider,
    sma20: calculateSMA(sorted, 20),
    sma50: calculateSMA(sorted, 50),
    ema20: calculateEMA(sorted, 20),
    ema50: calculateEMA(sorted, 50),
    rsi14: calculateRSI(sorted, 14),
    macd: calculateMACD(sorted, 12, 26, 9)
  };
}
