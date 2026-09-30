import { Time, LineData, HistogramData } from 'lightweight-charts';
import { Candle } from '../models/market.model';
import { ActiveIndicator } from '../models/indicator.model';

export interface IndicatorRenderSeries {
  id: string;
  name: string;
  type: 'line' | 'histogram';
  color: string;
  lineWidth?: number;
  lineStyle?: number; // 0: Solid, 1: Dotted, 2: Dashed
  data: (LineData<Time> | HistogramData<Time>)[];
  overlay: boolean;
  priceScaleId?: string;
  scaleMargins?: { top: number; bottom: number };
}

export function calculateIndicatorSeries(
  indicator: ActiveIndicator,
  candles: Candle[]
): IndicatorRenderSeries[] {
  if (!candles || candles.length === 0) return [];

  const params = indicator.params || {};
  const color = indicator.color || '#3b82f6';
  const width = indicator.lineWidth || 2;
  const isOverlay = indicator.isOverlay;

  switch (indicator.defId) {
    // ==========================================
    // 1. MOVING AVERAGES
    // ==========================================
    case 'sma': {
      const period = Number(params['period']) || 20;
      const data = calculateSMA(candles, period);
      return [
        {
          id: `${indicator.instanceId}_main`,
          name: `${indicator.shortName} (${period})`,
          type: 'line',
          color: color,
          lineWidth: width,
          data: data,
          overlay: true
        }
      ];
    }

    case 'ema': {
      const period = Number(params['period']) || 50;
      const data = calculateEMA(candles, period);
      return [
        {
          id: `${indicator.instanceId}_main`,
          name: `${indicator.shortName} (${period})`,
          type: 'line',
          color: color,
          lineWidth: width,
          data: data,
          overlay: true
        }
      ];
    }

    case 'wma': {
      const period = Number(params['period']) || 20;
      const data = calculateWMA(candles, period);
      return [
        {
          id: `${indicator.instanceId}_main`,
          name: `${indicator.shortName} (${period})`,
          type: 'line',
          color: color,
          lineWidth: width,
          data: data,
          overlay: true
        }
      ];
    }

    case 'hma': {
      const period = Number(params['period']) || 16;
      const data = calculateHMA(candles, period);
      return [
        {
          id: `${indicator.instanceId}_main`,
          name: `${indicator.shortName} (${period})`,
          type: 'line',
          color: color,
          lineWidth: width,
          data: data,
          overlay: true
        }
      ];
    }

    case 'dema': {
      const period = Number(params['period']) || 20;
      const data = calculateDEMA(candles, period);
      return [
        {
          id: `${indicator.instanceId}_main`,
          name: `${indicator.shortName} (${period})`,
          type: 'line',
          color: color,
          lineWidth: width,
          data: data,
          overlay: true
        }
      ];
    }

    case 'tema': {
      const period = Number(params['period']) || 20;
      const data = calculateTEMA(candles, period);
      return [
        {
          id: `${indicator.instanceId}_main`,
          name: `${indicator.shortName} (${period})`,
          type: 'line',
          color: color,
          lineWidth: width,
          data: data,
          overlay: true
        }
      ];
    }

    // ==========================================
    // 2. TREND
    // ==========================================
    case 'supertrend': {
      const period = Number(params['period']) || 10;
      const multiplier = Number(params['multiplier']) || 3;
      const data = calculateSupertrend(candles, period, multiplier);
      return [
        {
          id: `${indicator.instanceId}_main`,
          name: `Supertrend (${period}, ${multiplier})`,
          type: 'line',
          color: color,
          lineWidth: width,
          data: data,
          overlay: true
        }
      ];
    }

    case 'psar': {
      const step = Number(params['step']) || 0.02;
      const maxStep = Number(params['maxStep']) || 0.2;
      const data = calculatePSAR(candles, step, maxStep);
      return [
        {
          id: `${indicator.instanceId}_main`,
          name: `PSAR (${step}, ${maxStep})`,
          type: 'line',
          color: color,
          lineWidth: 1,
          lineStyle: 1, // Dotted
          data: data,
          overlay: true
        }
      ];
    }

    case 'ichimoku': {
      const period = Number(params['period']) || 26;
      const data = calculateIchimokuBaseline(candles, period);
      return [
        {
          id: `${indicator.instanceId}_main`,
          name: `Ichimoku Baseline (${period})`,
          type: 'line',
          color: color,
          lineWidth: width,
          data: data,
          overlay: true
        }
      ];
    }

    case 'adx': {
      const period = Number(params['period']) || 14;
      const data = calculateADX(candles, period);
      return [
        {
          id: `${indicator.instanceId}_main`,
          name: `ADX (${period})`,
          type: 'line',
          color: color,
          lineWidth: width,
          data: data,
          overlay: false,
          priceScaleId: 'adx_scale'
        }
      ];
    }

    case 'aroon': {
      const period = Number(params['period']) || 14;
      const data = calculateAroon(candles, period);
      return [
        {
          id: `${indicator.instanceId}_main`,
          name: `Aroon Osc (${period})`,
          type: 'line',
          color: color,
          lineWidth: width,
          data: data,
          overlay: false,
          priceScaleId: 'aroon_scale'
        }
      ];
    }

    case 'zigzag': {
      const deviation = Number(params['deviation']) || 5;
      const data = calculateZigZag(candles, deviation);
      return [
        {
          id: `${indicator.instanceId}_main`,
          name: `ZigZag (${deviation}%)`,
          type: 'line',
          color: color,
          lineWidth: width,
          data: data,
          overlay: true
        }
      ];
    }

    // ==========================================
    // 3. VOLATILITY
    // ==========================================
    case 'bb': {
      const period = Number(params['period']) || 20;
      const stdDev = Number(params['stdDev']) || 2;
      const { middle, upper, lower } = calculateBollingerBands(candles, period, stdDev);
      return [
        {
          id: `${indicator.instanceId}_mid`,
          name: `BB Mid (${period})`,
          type: 'line',
          color: color,
          lineWidth: width,
          data: middle,
          overlay: true
        },
        {
          id: `${indicator.instanceId}_up`,
          name: `BB Upper (${period}, ${stdDev})`,
          type: 'line',
          color: 'rgba(99, 102, 241, 0.7)',
          lineWidth: 1,
          lineStyle: 2, // dashed
          data: upper,
          overlay: true
        },
        {
          id: `${indicator.instanceId}_low`,
          name: `BB Lower (${period}, ${stdDev})`,
          type: 'line',
          color: 'rgba(99, 102, 241, 0.7)',
          lineWidth: 1,
          lineStyle: 2,
          data: lower,
          overlay: true
        }
      ];
    }

    case 'atr': {
      const period = Number(params['period']) || 14;
      const data = calculateATR(candles, period);
      return [
        {
          id: `${indicator.instanceId}_main`,
          name: `ATR (${period})`,
          type: 'line',
          color: color,
          lineWidth: width,
          data: data,
          overlay: false,
          priceScaleId: 'atr_scale'
        }
      ];
    }

    case 'keltner': {
      const period = Number(params['period']) || 20;
      const multiplier = Number(params['multiplier']) || 2;
      const { middle, upper, lower } = calculateKeltner(candles, period, multiplier);
      return [
        {
          id: `${indicator.instanceId}_mid`,
          name: `Keltner Mid (${period})`,
          type: 'line',
          color: color,
          lineWidth: width,
          data: middle,
          overlay: true
        },
        {
          id: `${indicator.instanceId}_up`,
          name: `Keltner Upper (${period}, ${multiplier})`,
          type: 'line',
          color: 'rgba(168, 85, 247, 0.7)',
          lineWidth: 1,
          lineStyle: 2,
          data: upper,
          overlay: true
        },
        {
          id: `${indicator.instanceId}_low`,
          name: `Keltner Lower (${period}, ${multiplier})`,
          type: 'line',
          color: 'rgba(168, 85, 247, 0.7)',
          lineWidth: 1,
          lineStyle: 2,
          data: lower,
          overlay: true
        }
      ];
    }

    case 'donchian': {
      const period = Number(params['period']) || 20;
      const { upper, lower, middle } = calculateDonchian(candles, period);
      return [
        {
          id: `${indicator.instanceId}_up`,
          name: `Donchian Upper (${period})`,
          type: 'line',
          color: color,
          lineWidth: 1,
          data: upper,
          overlay: true
        },
        {
          id: `${indicator.instanceId}_low`,
          name: `Donchian Lower (${period})`,
          type: 'line',
          color: color,
          lineWidth: 1,
          data: lower,
          overlay: true
        },
        {
          id: `${indicator.instanceId}_mid`,
          name: `Donchian Mid (${period})`,
          type: 'line',
          color: 'rgba(14, 165, 233, 0.5)',
          lineWidth: 1,
          lineStyle: 1,
          data: middle,
          overlay: true
        }
      ];
    }

    case 'stddev': {
      const period = Number(params['period']) || 20;
      const data = calculateStdDev(candles, period);
      return [
        {
          id: `${indicator.instanceId}_main`,
          name: `StdDev (${period})`,
          type: 'line',
          color: color,
          lineWidth: width,
          data: data,
          overlay: false,
          priceScaleId: 'stddev_scale'
        }
      ];
    }

    case 'histvol': {
      const period = Number(params['period']) || 30;
      const data = calculateHistoricalVolatility(candles, period);
      return [
        {
          id: `${indicator.instanceId}_main`,
          name: `HistVol (${period})`,
          type: 'line',
          color: color,
          lineWidth: width,
          data: data,
          overlay: false,
          priceScaleId: 'histvol_scale'
        }
      ];
    }

    // ==========================================
    // 4. MOMENTUM
    // ==========================================
    case 'rsi': {
      const period = Number(params['period']) || 14;
      const data = calculateRSI(candles, period);
      return [
        {
          id: `${indicator.instanceId}_main`,
          name: `RSI (${period})`,
          type: 'line',
          color: color,
          lineWidth: width,
          data: data,
          overlay: false,
          priceScaleId: 'rsi_scale',
          scaleMargins: { top: 0.75, bottom: 0.02 }
        }
      ];
    }

    case 'macd': {
      const fast = Number(params['fast']) || 12;
      const slow = Number(params['slow']) || 26;
      const signal = Number(params['signal']) || 9;
      const { macd, signalLine, hist } = calculateMACD(candles, fast, slow, signal);
      return [
        {
          id: `${indicator.instanceId}_macd`,
          name: `MACD (${fast}, ${slow})`,
          type: 'line',
          color: color,
          lineWidth: width,
          data: macd,
          overlay: false,
          priceScaleId: 'macd_scale',
          scaleMargins: { top: 0.75, bottom: 0.02 }
        },
        {
          id: `${indicator.instanceId}_sig`,
          name: `Signal (${signal})`,
          type: 'line',
          color: '#f59e0b',
          lineWidth: 1,
          data: signalLine,
          overlay: false,
          priceScaleId: 'macd_scale',
          scaleMargins: { top: 0.75, bottom: 0.02 }
        },
        {
          id: `${indicator.instanceId}_hist`,
          name: `Histogram`,
          type: 'histogram',
          color: 'rgba(59, 130, 246, 0.5)',
          data: hist,
          overlay: false,
          priceScaleId: 'macd_scale',
          scaleMargins: { top: 0.75, bottom: 0.02 }
        }
      ];
    }

    case 'stoch': {
      const kPeriod = Number(params['kPeriod']) || 14;
      const dPeriod = Number(params['dPeriod']) || 3;
      const { kLine, dLine } = calculateStochastic(candles, kPeriod, dPeriod);
      return [
        {
          id: `${indicator.instanceId}_k`,
          name: `%K (${kPeriod})`,
          type: 'line',
          color: color,
          lineWidth: width,
          data: kLine,
          overlay: false,
          priceScaleId: 'stoch_scale',
          scaleMargins: { top: 0.75, bottom: 0.02 }
        },
        {
          id: `${indicator.instanceId}_d`,
          name: `%D (${dPeriod})`,
          type: 'line',
          color: '#f59e0b',
          lineWidth: 1,
          data: dLine,
          overlay: false,
          priceScaleId: 'stoch_scale',
          scaleMargins: { top: 0.75, bottom: 0.02 }
        }
      ];
    }

    case 'williams_r': {
      const period = Number(params['period']) || 14;
      const data = calculateWilliamsR(candles, period);
      return [
        {
          id: `${indicator.instanceId}_main`,
          name: `Williams %R (${period})`,
          type: 'line',
          color: color,
          lineWidth: width,
          data: data,
          overlay: false,
          priceScaleId: 'wr_scale'
        }
      ];
    }

    case 'cci': {
      const period = Number(params['period']) || 20;
      const data = calculateCCI(candles, period);
      return [
        {
          id: `${indicator.instanceId}_main`,
          name: `CCI (${period})`,
          type: 'line',
          color: color,
          lineWidth: width,
          data: data,
          overlay: false,
          priceScaleId: 'cci_scale'
        }
      ];
    }

    case 'roc': {
      const period = Number(params['period']) || 12;
      const data = calculateROC(candles, period);
      return [
        {
          id: `${indicator.instanceId}_main`,
          name: `ROC (${period})`,
          type: 'line',
          color: color,
          lineWidth: width,
          data: data,
          overlay: false,
          priceScaleId: 'roc_scale'
        }
      ];
    }

    // ==========================================
    // 5. VOLUME
    // ==========================================
    case 'volume_sma': {
      const period = Number(params['period']) || 20;
      const data = calculateVolumeSMA(candles, period);
      return [
        {
          id: `${indicator.instanceId}_main`,
          name: `Vol SMA (${period})`,
          type: 'line',
          color: color,
          lineWidth: width,
          data: data,
          overlay: false,
          priceScaleId: '' // attach to default volume sub-scale
        }
      ];
    }

    case 'vwap': {
      const data = calculateVWAP(candles);
      return [
        {
          id: `${indicator.instanceId}_main`,
          name: `VWAP`,
          type: 'line',
          color: color,
          lineWidth: width,
          data: data,
          overlay: true
        }
      ];
    }

    case 'obv': {
      const data = calculateOBV(candles);
      return [
        {
          id: `${indicator.instanceId}_main`,
          name: `OBV`,
          type: 'line',
          color: color,
          lineWidth: width,
          data: data,
          overlay: false,
          priceScaleId: 'obv_scale'
        }
      ];
    }

    case 'cmf': {
      const period = Number(params['period']) || 20;
      const data = calculateCMF(candles, period);
      return [
        {
          id: `${indicator.instanceId}_main`,
          name: `CMF (${period})`,
          type: 'line',
          color: color,
          lineWidth: width,
          data: data,
          overlay: false,
          priceScaleId: 'cmf_scale'
        }
      ];
    }

    case 'mfi': {
      const period = Number(params['period']) || 14;
      const data = calculateMFI(candles, period);
      return [
        {
          id: `${indicator.instanceId}_main`,
          name: `MFI (${period})`,
          type: 'line',
          color: color,
          lineWidth: width,
          data: data,
          overlay: false,
          priceScaleId: 'mfi_scale'
        }
      ];
    }

    case 'ad': {
      const data = calculateAccumulationDistribution(candles);
      return [
        {
          id: `${indicator.instanceId}_main`,
          name: `A/D Line`,
          type: 'line',
          color: color,
          lineWidth: width,
          data: data,
          overlay: false,
          priceScaleId: 'ad_scale'
        }
      ];
    }

    // ==========================================
    // 6. OSCILLATORS
    // ==========================================
    case 'ao': {
      const fast = Number(params['fast']) || 5;
      const slow = Number(params['slow']) || 34;
      const data = calculateAwesomeOscillator(candles, fast, slow);
      return [
        {
          id: `${indicator.instanceId}_main`,
          name: `AO (${fast}, ${slow})`,
          type: 'histogram',
          color: color,
          data: data,
          overlay: false,
          priceScaleId: 'ao_scale'
        }
      ];
    }

    case 'uo': {
      const s = Number(params['short']) || 7;
      const m = Number(params['mid']) || 14;
      const l = Number(params['long']) || 28;
      const data = calculateUltimateOscillator(candles, s, m, l);
      return [
        {
          id: `${indicator.instanceId}_main`,
          name: `UO (${s}, ${m}, ${l})`,
          type: 'line',
          color: color,
          lineWidth: width,
          data: data,
          overlay: false,
          priceScaleId: 'uo_scale'
        }
      ];
    }

    case 'rvi': {
      const period = Number(params['period']) || 10;
      const data = calculateRVI(candles, period);
      return [
        {
          id: `${indicator.instanceId}_main`,
          name: `RVI (${period})`,
          type: 'line',
          color: color,
          lineWidth: width,
          data: data,
          overlay: false,
          priceScaleId: 'rvi_scale'
        }
      ];
    }

    case 'dpo': {
      const period = Number(params['period']) || 20;
      const data = calculateDPO(candles, period);
      return [
        {
          id: `${indicator.instanceId}_main`,
          name: `DPO (${period})`,
          type: 'line',
          color: color,
          lineWidth: width,
          data: data,
          overlay: false,
          priceScaleId: 'dpo_scale'
        }
      ];
    }

    default:
      return [];
  }
}

// ============================================================================
// MATHEMATICAL CALCULATION IMPLEMENTATIONS
// ============================================================================

export function calculateSMA(candles: Candle[], period: number): LineData<Time>[] {
  const result: LineData<Time>[] = [];
  if (candles.length < period) return result;

  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += candles[i].close;
  }
  result.push({
    time: (candles[period - 1].timestamp as unknown) as Time,
    value: Number((sum / period).toFixed(4))
  });

  for (let i = period; i < candles.length; i++) {
    sum += candles[i].close - candles[i - period].close;
    result.push({
      time: (candles[i].timestamp as unknown) as Time,
      value: Number((sum / period).toFixed(4))
    });
  }
  return result;
}

export function calculateEMA(candles: Candle[], period: number): LineData<Time>[] {
  const result: LineData<Time>[] = [];
  if (candles.length < period) return result;

  const k = 2 / (period + 1);
  let ema = 0;

  for (let i = 0; i < period; i++) {
    ema += candles[i].close;
  }
  ema /= period;

  result.push({
    time: (candles[period - 1].timestamp as unknown) as Time,
    value: Number(ema.toFixed(4))
  });

  for (let i = period; i < candles.length; i++) {
    ema = candles[i].close * k + ema * (1 - k);
    result.push({
      time: (candles[i].timestamp as unknown) as Time,
      value: Number(ema.toFixed(4))
    });
  }
  return result;
}

export function calculateWMA(candles: Candle[], period: number): LineData<Time>[] {
  const result: LineData<Time>[] = [];
  if (candles.length < period) return result;

  const weightSum = (period * (period + 1)) / 2;

  for (let i = period - 1; i < candles.length; i++) {
    let weightedSum = 0;
    for (let j = 0; j < period; j++) {
      weightedSum += candles[i - j].close * (period - j);
    }
    result.push({
      time: (candles[i].timestamp as unknown) as Time,
      value: Number((weightedSum / weightSum).toFixed(4))
    });
  }
  return result;
}

export function calculateHMA(candles: Candle[], period: number): LineData<Time>[] {
  const halfPeriod = Math.max(Math.floor(period / 2), 1);
  const sqrtPeriod = Math.max(Math.round(Math.sqrt(period)), 1);

  const wmaHalf = calculateWMA(candles, halfPeriod);
  const wmaFull = calculateWMA(candles, period);

  // Align timestamps
  const diffCandles: Candle[] = [];
  const fullMap = new Map<number, number>();
  wmaFull.forEach(p => fullMap.set(Number(p.time), p.value));

  wmaHalf.forEach(halfP => {
    const t = Number(halfP.time);
    const fullVal = fullMap.get(t);
    if (fullVal !== undefined) {
      const diffVal = 2 * halfP.value - fullVal;
      diffCandles.push({
        timestamp: t,
        open: diffVal,
        high: diffVal,
        low: diffVal,
        close: diffVal,
        volume: 0
      });
    }
  });

  return calculateWMA(diffCandles, sqrtPeriod);
}

export function calculateDEMA(candles: Candle[], period: number): LineData<Time>[] {
  const ema1 = calculateEMA(candles, period);
  if (ema1.length < period) return [];

  const ema1Candles: Candle[] = ema1.map(p => ({
    timestamp: Number(p.time),
    open: p.value,
    high: p.value,
    low: p.value,
    close: p.value,
    volume: 0
  }));

  const ema2 = calculateEMA(ema1Candles, period);
  const ema2Map = new Map<number, number>();
  ema2.forEach(p => ema2Map.set(Number(p.time), p.value));

  const result: LineData<Time>[] = [];
  ema1.forEach(p1 => {
    const t = Number(p1.time);
    const v2 = ema2Map.get(t);
    if (v2 !== undefined) {
      result.push({
        time: (t as unknown) as Time,
        value: Number((2 * p1.value - v2).toFixed(4))
      });
    }
  });
  return result;
}

export function calculateTEMA(candles: Candle[], period: number): LineData<Time>[] {
  const ema1 = calculateEMA(candles, period);
  if (ema1.length < period) return [];

  const ema1Candles: Candle[] = ema1.map(p => ({
    timestamp: Number(p.time),
    open: p.value,
    high: p.value,
    low: p.value,
    close: p.value,
    volume: 0
  }));

  const ema2 = calculateEMA(ema1Candles, period);
  if (ema2.length < period) return [];

  const ema2Candles: Candle[] = ema2.map(p => ({
    timestamp: Number(p.time),
    open: p.value,
    high: p.value,
    low: p.value,
    close: p.value,
    volume: 0
  }));

  const ema3 = calculateEMA(ema2Candles, period);
  const ema1Map = new Map<number, number>();
  ema1.forEach(p => ema1Map.set(Number(p.time), p.value));
  const ema2Map = new Map<number, number>();
  ema2.forEach(p => ema2Map.set(Number(p.time), p.value));

  const result: LineData<Time>[] = [];
  ema3.forEach(p3 => {
    const t = Number(p3.time);
    const v1 = ema1Map.get(t);
    const v2 = ema2Map.get(t);
    if (v1 !== undefined && v2 !== undefined) {
      const tema = 3 * v1 - 3 * v2 + p3.value;
      result.push({
        time: (t as unknown) as Time,
        value: Number(tema.toFixed(4))
      });
    }
  });
  return result;
}

export function calculateBollingerBands(
  candles: Candle[],
  period: number,
  stdDevMult: number
): { middle: LineData<Time>[]; upper: LineData<Time>[]; lower: LineData<Time>[] } {
  const middle: LineData<Time>[] = [];
  const upper: LineData<Time>[] = [];
  const lower: LineData<Time>[] = [];

  if (candles.length < period) return { middle, upper, lower };

  for (let i = period - 1; i < candles.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += candles[i - j].close;
    }
    const sma = sum / period;

    let varianceSum = 0;
    for (let j = 0; j < period; j++) {
      varianceSum += Math.pow(candles[i - j].close - sma, 2);
    }
    const stdDev = Math.sqrt(varianceSum / period);
    const t = (candles[i].timestamp as unknown) as Time;

    middle.push({ time: t, value: Number(sma.toFixed(4)) });
    upper.push({ time: t, value: Number((sma + stdDevMult * stdDev).toFixed(4)) });
    lower.push({ time: t, value: Number((sma - stdDevMult * stdDev).toFixed(4)) });
  }

  return { middle, upper, lower };
}

export function calculateSupertrend(candles: Candle[], period: number, multiplier: number): LineData<Time>[] {
  const result: LineData<Time>[] = [];
  if (candles.length < period + 1) return result;

  const atr = calculateATR(candles, period);
  const atrMap = new Map<number, number>();
  atr.forEach(p => atrMap.set(Number(p.time), p.value));

  let inUptrend = true;
  let lowerBand = 0;
  let upperBand = 0;

  for (let i = period; i < candles.length; i++) {
    const c = candles[i];
    const prevC = candles[i - 1];
    const t = c.timestamp;
    const atrVal = atrMap.get(t) || (c.high - c.low);

    const hl2 = (c.high + c.low) / 2;
    const basicUpper = hl2 + multiplier * atrVal;
    const basicLower = hl2 - multiplier * atrVal;

    if (i === period) {
      upperBand = basicUpper;
      lowerBand = basicLower;
    } else {
      lowerBand = basicLower > lowerBand || prevC.close < lowerBand ? basicLower : lowerBand;
      upperBand = basicUpper < upperBand || prevC.close > upperBand ? basicUpper : upperBand;
    }

    if (inUptrend && c.close < lowerBand) {
      inUptrend = false;
    } else if (!inUptrend && c.close > upperBand) {
      inUptrend = true;
    }

    const val = inUptrend ? lowerBand : upperBand;
    result.push({
      time: (t as unknown) as Time,
      value: Number(val.toFixed(4))
    });
  }

  return result;
}

export function calculatePSAR(candles: Candle[], step: number, maxStep: number): LineData<Time>[] {
  const result: LineData<Time>[] = [];
  if (candles.length < 2) return result;

  let isUp = candles[1].close >= candles[0].close;
  let af = step;
  let ep = isUp ? candles[1].high : candles[1].low;
  let sar = isUp ? candles[0].low : candles[0].high;

  result.push({
    time: (candles[0].timestamp as unknown) as Time,
    value: Number(sar.toFixed(4))
  });

  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];
    const prev = candles[i - 1];

    if (isUp) {
      sar = sar + af * (ep - sar);
      if (i > 1) {
        sar = Math.min(sar, prev.low, candles[i - 2].low);
      } else {
        sar = Math.min(sar, prev.low);
      }

      if (c.low < sar) {
        isUp = false;
        sar = ep;
        af = step;
        ep = c.low;
      } else {
        if (c.high > ep) {
          ep = c.high;
          af = Math.min(af + step, maxStep);
        }
      }
    } else {
      sar = sar + af * (ep - sar);
      if (i > 1) {
        sar = Math.max(sar, prev.high, candles[i - 2].high);
      } else {
        sar = Math.max(sar, prev.high);
      }

      if (c.high > sar) {
        isUp = true;
        sar = ep;
        af = step;
        ep = c.high;
      } else {
        if (c.low < ep) {
          ep = c.low;
          af = Math.min(af + step, maxStep);
        }
      }
    }

    result.push({
      time: (c.timestamp as unknown) as Time,
      value: Number(sar.toFixed(4))
    });
  }

  return result;
}

export function calculateIchimokuBaseline(candles: Candle[], period: number): LineData<Time>[] {
  const result: LineData<Time>[] = [];
  if (candles.length < period) return result;

  for (let i = period - 1; i < candles.length; i++) {
    let highest = -Infinity;
    let lowest = Infinity;
    for (let j = 0; j < period; j++) {
      if (candles[i - j].high > highest) highest = candles[i - j].high;
      if (candles[i - j].low < lowest) lowest = candles[i - j].low;
    }
    const val = (highest + lowest) / 2;
    result.push({
      time: (candles[i].timestamp as unknown) as Time,
      value: Number(val.toFixed(4))
    });
  }
  return result;
}

export function calculateADX(candles: Candle[], period: number): LineData<Time>[] {
  const result: LineData<Time>[] = [];
  if (candles.length < period * 2) return result;

  const dxList: { time: number; dx: number }[] = [];

  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];
    const prev = candles[i - 1];

    const upMove = c.high - prev.high;
    const downMove = prev.low - c.low;

    const plusDM = upMove > downMove && upMove > 0 ? upMove : 0;
    const minusDM = downMove > upMove && downMove > 0 ? downMove : 0;
    const tr = Math.max(c.high - c.low, Math.abs(c.high - prev.close), Math.abs(c.low - prev.close));

    const diDiff = Math.abs(plusDM - minusDM);
    const diSum = plusDM + minusDM;
    const dx = diSum === 0 ? 0 : (diDiff / diSum) * 100;
    dxList.push({ time: c.timestamp, dx });
  }

  if (dxList.length < period) return result;

  for (let i = period - 1; i < dxList.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += dxList[i - j].dx;
    }
    result.push({
      time: (dxList[i].time as unknown) as Time,
      value: Number((sum / period).toFixed(2))
    });
  }

  return result;
}

export function calculateAroon(candles: Candle[], period: number): LineData<Time>[] {
  const result: LineData<Time>[] = [];
  if (candles.length < period + 1) return result;

  for (let i = period; i < candles.length; i++) {
    let highIdx = 0;
    let lowIdx = 0;
    let highest = -Infinity;
    let lowest = Infinity;

    for (let j = 0; j <= period; j++) {
      const idx = i - j;
      if (candles[idx].high > highest) {
        highest = candles[idx].high;
        highIdx = j;
      }
      if (candles[idx].low < lowest) {
        lowest = candles[idx].low;
        lowIdx = j;
      }
    }

    const aroonUp = ((period - highIdx) / period) * 100;
    const aroonDown = ((period - lowIdx) / period) * 100;
    const aroonOsc = aroonUp - aroonDown;

    result.push({
      time: (candles[i].timestamp as unknown) as Time,
      value: Number(aroonOsc.toFixed(2))
    });
  }

  return result;
}

export function calculateZigZag(candles: Candle[], deviationPct: number): LineData<Time>[] {
  const result: LineData<Time>[] = [];
  if (candles.length < 5) return result;

  let lastSwingHigh = candles[0].high;
  let lastSwingLow = candles[0].low;
  let lookingForHigh = true;

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    if (lookingForHigh) {
      if (c.high > lastSwingHigh) {
        lastSwingHigh = c.high;
      } else if (c.low <= lastSwingHigh * (1 - deviationPct / 100)) {
        result.push({
          time: (c.timestamp as unknown) as Time,
          value: Number(lastSwingHigh.toFixed(4))
        });
        lookingForHigh = false;
        lastSwingLow = c.low;
      }
    } else {
      if (c.low < lastSwingLow) {
        lastSwingLow = c.low;
      } else if (c.high >= lastSwingLow * (1 + deviationPct / 100)) {
        result.push({
          time: (c.timestamp as unknown) as Time,
          value: Number(lastSwingLow.toFixed(4))
        });
        lookingForHigh = true;
        lastSwingHigh = c.high;
      }
    }
  }

  if (result.length === 0) {
    result.push(
      { time: (candles[0].timestamp as unknown) as Time, value: candles[0].close },
      { time: (candles[candles.length - 1].timestamp as unknown) as Time, value: candles[candles.length - 1].close }
    );
  }

  return result;
}

export function calculateATR(candles: Candle[], period: number): LineData<Time>[] {
  const result: LineData<Time>[] = [];
  if (candles.length < period + 1) return result;

  const trs: { time: number; tr: number }[] = [];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];
    const prev = candles[i - 1];
    const tr = Math.max(c.high - c.low, Math.abs(c.high - prev.close), Math.abs(c.low - prev.close));
    trs.push({ time: c.timestamp, tr });
  }

  let atr = 0;
  for (let i = 0; i < period; i++) {
    atr += trs[i].tr;
  }
  atr /= period;

  result.push({
    time: (trs[period - 1].time as unknown) as Time,
    value: Number(atr.toFixed(4))
  });

  for (let i = period; i < trs.length; i++) {
    atr = (atr * (period - 1) + trs[i].tr) / period;
    result.push({
      time: (trs[i].time as unknown) as Time,
      value: Number(atr.toFixed(4))
    });
  }

  return result;
}

export function calculateKeltner(
  candles: Candle[],
  period: number,
  multiplier: number
): { middle: LineData<Time>[]; upper: LineData<Time>[]; lower: LineData<Time>[] } {
  const middle = calculateEMA(candles, period);
  const atr = calculateATR(candles, period);
  const atrMap = new Map<number, number>();
  atr.forEach(p => atrMap.set(Number(p.time), p.value));

  const upper: LineData<Time>[] = [];
  const lower: LineData<Time>[] = [];
  const finalMiddle: LineData<Time>[] = [];

  middle.forEach(m => {
    const t = Number(m.time);
    const atrVal = atrMap.get(t);
    if (atrVal !== undefined) {
      finalMiddle.push(m);
      upper.push({ time: (t as unknown) as Time, value: Number((m.value + multiplier * atrVal).toFixed(4)) });
      lower.push({ time: (t as unknown) as Time, value: Number((m.value - multiplier * atrVal).toFixed(4)) });
    }
  });

  return { middle: finalMiddle, upper, lower };
}

export function calculateDonchian(
  candles: Candle[],
  period: number
): { upper: LineData<Time>[]; lower: LineData<Time>[]; middle: LineData<Time>[] } {
  const upper: LineData<Time>[] = [];
  const lower: LineData<Time>[] = [];
  const middle: LineData<Time>[] = [];

  if (candles.length < period) return { upper, lower, middle };

  for (let i = period - 1; i < candles.length; i++) {
    let highest = -Infinity;
    let lowest = Infinity;
    for (let j = 0; j < period; j++) {
      if (candles[i - j].high > highest) highest = candles[i - j].high;
      if (candles[i - j].low < lowest) lowest = candles[i - j].low;
    }
    const t = (candles[i].timestamp as unknown) as Time;
    const midVal = (highest + lowest) / 2;

    upper.push({ time: t, value: Number(highest.toFixed(4)) });
    lower.push({ time: t, value: Number(lowest.toFixed(4)) });
    middle.push({ time: t, value: Number(midVal.toFixed(4)) });
  }

  return { upper, lower, middle };
}

export function calculateStdDev(candles: Candle[], period: number): LineData<Time>[] {
  const result: LineData<Time>[] = [];
  if (candles.length < period) return result;

  for (let i = period - 1; i < candles.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += candles[i - j].close;
    }
    const mean = sum / period;

    let variance = 0;
    for (let j = 0; j < period; j++) {
      variance += Math.pow(candles[i - j].close - mean, 2);
    }
    const sd = Math.sqrt(variance / period);
    result.push({
      time: (candles[i].timestamp as unknown) as Time,
      value: Number(sd.toFixed(4))
    });
  }
  return result;
}

export function calculateHistoricalVolatility(candles: Candle[], period: number): LineData<Time>[] {
  const result: LineData<Time>[] = [];
  if (candles.length < period + 1) return result;

  const logReturns: { time: number; ret: number }[] = [];
  for (let i = 1; i < candles.length; i++) {
    const ret = Math.log(candles[i].close / candles[i - 1].close);
    logReturns.push({ time: candles[i].timestamp, ret });
  }

  for (let i = period - 1; i < logReturns.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += logReturns[i - j].ret;
    }
    const mean = sum / period;

    let varSum = 0;
    for (let j = 0; j < period; j++) {
      varSum += Math.pow(logReturns[i - j].ret - mean, 2);
    }
    const std = Math.sqrt(varSum / (period - 1));
    const annualizedHV = std * Math.sqrt(252) * 100;

    result.push({
      time: (logReturns[i].time as unknown) as Time,
      value: Number(annualizedHV.toFixed(2))
    });
  }

  return result;
}

export function calculateRSI(candles: Candle[], period: number): LineData<Time>[] {
  const result: LineData<Time>[] = [];
  if (candles.length < period + 1) return result;

  let gainSum = 0;
  let lossSum = 0;

  for (let i = 1; i <= period; i++) {
    const diff = candles[i].close - candles[i - 1].close;
    if (diff >= 0) gainSum += diff;
    else lossSum += Math.abs(diff);
  }

  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;

  let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  let rsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + rs);

  result.push({
    time: (candles[period].timestamp as unknown) as Time,
    value: Number(rsi.toFixed(2))
  });

  for (let i = period + 1; i < candles.length; i++) {
    const diff = candles[i].close - candles[i - 1].close;
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + rs);

    result.push({
      time: (candles[i].timestamp as unknown) as Time,
      value: Number(rsi.toFixed(2))
    });
  }

  return result;
}

export function calculateMACD(
  candles: Candle[],
  fast: number,
  slow: number,
  signal: number
): {
  macd: LineData<Time>[];
  signalLine: LineData<Time>[];
  hist: HistogramData<Time>[];
} {
  const macd: LineData<Time>[] = [];
  const signalLine: LineData<Time>[] = [];
  const hist: HistogramData<Time>[] = [];

  const fastEMA = calculateEMA(candles, fast);
  const slowEMA = calculateEMA(candles, slow);

  const slowMap = new Map<number, number>();
  slowEMA.forEach(p => slowMap.set(Number(p.time), p.value));

  const macdCandles: Candle[] = [];
  fastEMA.forEach(p => {
    const t = Number(p.time);
    const slowVal = slowMap.get(t);
    if (slowVal !== undefined) {
      const macdVal = p.value - slowVal;
      macd.push({ time: (t as unknown) as Time, value: Number(macdVal.toFixed(4)) });
      macdCandles.push({
        timestamp: t,
        open: macdVal,
        high: macdVal,
        low: macdVal,
        close: macdVal,
        volume: 0
      });
    }
  });

  const sigEMA = calculateEMA(macdCandles, signal);
  const sigMap = new Map<number, number>();
  sigEMA.forEach(p => {
    sigMap.set(Number(p.time), p.value);
    signalLine.push(p);
  });

  macd.forEach(m => {
    const t = Number(m.time);
    const s = sigMap.get(t);
    if (s !== undefined) {
      const h = m.value - s;
      hist.push({
        time: (t as unknown) as Time,
        value: Number(h.toFixed(4)),
        color: h >= 0 ? 'rgba(16, 185, 129, 0.6)' : 'rgba(244, 63, 94, 0.6)'
      });
    }
  });

  return { macd, signalLine, hist };
}

export function calculateStochastic(
  candles: Candle[],
  kPeriod: number,
  dPeriod: number
): { kLine: LineData<Time>[]; dLine: LineData<Time>[] } {
  const kLine: LineData<Time>[] = [];
  const dLine: LineData<Time>[] = [];

  if (candles.length < kPeriod) return { kLine, dLine };

  const rawK: { time: number; k: number }[] = [];
  for (let i = kPeriod - 1; i < candles.length; i++) {
    let highest = -Infinity;
    let lowest = Infinity;
    for (let j = 0; j < kPeriod; j++) {
      if (candles[i - j].high > highest) highest = candles[i - j].high;
      if (candles[i - j].low < lowest) lowest = candles[i - j].low;
    }
    const range = highest - lowest;
    const k = range === 0 ? 50 : ((candles[i].close - lowest) / range) * 100;
    rawK.push({ time: candles[i].timestamp, k });
    kLine.push({ time: (candles[i].timestamp as unknown) as Time, value: Number(k.toFixed(2)) });
  }

  if (rawK.length < dPeriod) return { kLine, dLine };

  for (let i = dPeriod - 1; i < rawK.length; i++) {
    let sum = 0;
    for (let j = 0; j < dPeriod; j++) {
      sum += rawK[i - j].k;
    }
    dLine.push({
      time: (rawK[i].time as unknown) as Time,
      value: Number((sum / dPeriod).toFixed(2))
    });
  }

  return { kLine, dLine };
}

export function calculateWilliamsR(candles: Candle[], period: number): LineData<Time>[] {
  const result: LineData<Time>[] = [];
  if (candles.length < period) return result;

  for (let i = period - 1; i < candles.length; i++) {
    let highest = -Infinity;
    let lowest = Infinity;
    for (let j = 0; j < period; j++) {
      if (candles[i - j].high > highest) highest = candles[i - j].high;
      if (candles[i - j].low < lowest) lowest = candles[i - j].low;
    }
    const range = highest - lowest;
    const wr = range === 0 ? -50 : ((highest - candles[i].close) / range) * -100;
    result.push({
      time: (candles[i].timestamp as unknown) as Time,
      value: Number(wr.toFixed(2))
    });
  }
  return result;
}

export function calculateCCI(candles: Candle[], period: number): LineData<Time>[] {
  const result: LineData<Time>[] = [];
  if (candles.length < period) return result;

  const tps: { time: number; tp: number }[] = candles.map(c => ({
    time: c.timestamp,
    tp: (c.high + c.low + c.close) / 3
  }));

  for (let i = period - 1; i < tps.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += tps[i - j].tp;
    }
    const smaTP = sum / period;

    let devSum = 0;
    for (let j = 0; j < period; j++) {
      devSum += Math.abs(tps[i - j].tp - smaTP);
    }
    const meanDev = devSum / period;
    const cci = meanDev === 0 ? 0 : (tps[i].tp - smaTP) / (0.015 * meanDev);

    result.push({
      time: (tps[i].time as unknown) as Time,
      value: Number(cci.toFixed(2))
    });
  }

  return result;
}

export function calculateROC(candles: Candle[], period: number): LineData<Time>[] {
  const result: LineData<Time>[] = [];
  if (candles.length < period + 1) return result;

  for (let i = period; i < candles.length; i++) {
    const prev = candles[i - period].close;
    const roc = prev === 0 ? 0 : ((candles[i].close - prev) / prev) * 100;
    result.push({
      time: (candles[i].timestamp as unknown) as Time,
      value: Number(roc.toFixed(2))
    });
  }
  return result;
}

export function calculateVolumeSMA(candles: Candle[], period: number): LineData<Time>[] {
  const result: LineData<Time>[] = [];
  if (candles.length < period) return result;

  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += candles[i].volume || 0;
  }
  result.push({
    time: (candles[period - 1].timestamp as unknown) as Time,
    value: Number((sum / period).toFixed(0))
  });

  for (let i = period; i < candles.length; i++) {
    sum += (candles[i].volume || 0) - (candles[i - period].volume || 0);
    result.push({
      time: (candles[i].timestamp as unknown) as Time,
      value: Number((sum / period).toFixed(0))
    });
  }
  return result;
}

export function calculateVWAP(candles: Candle[]): LineData<Time>[] {
  const result: LineData<Time>[] = [];
  let cumTPV = 0;
  let cumVol = 0;

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const tp = (c.high + c.low + c.close) / 3;
    const vol = c.volume || 1;

    cumTPV += tp * vol;
    cumVol += vol;

    const vwap = cumVol === 0 ? tp : cumTPV / cumVol;
    result.push({
      time: (c.timestamp as unknown) as Time,
      value: Number(vwap.toFixed(4))
    });
  }

  return result;
}

export function calculateOBV(candles: Candle[]): LineData<Time>[] {
  const result: LineData<Time>[] = [];
  if (candles.length === 0) return result;

  let obv = 0;
  result.push({
    time: (candles[0].timestamp as unknown) as Time,
    value: obv
  });

  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];
    const prev = candles[i - 1];
    const vol = c.volume || 0;

    if (c.close > prev.close) {
      obv += vol;
    } else if (c.close < prev.close) {
      obv -= vol;
    }

    result.push({
      time: (c.timestamp as unknown) as Time,
      value: obv
    });
  }

  return result;
}

export function calculateCMF(candles: Candle[], period: number): LineData<Time>[] {
  const result: LineData<Time>[] = [];
  if (candles.length < period) return result;

  const mfvs: { time: number; mfv: number; vol: number }[] = [];
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const range = c.high - c.low;
    const vol = c.volume || 0;
    const mfm = range === 0 ? 0 : ((c.close - c.low) - (c.high - c.close)) / range;
    mfvs.push({ time: c.timestamp, mfv: mfm * vol, vol });
  }

  for (let i = period - 1; i < mfvs.length; i++) {
    let sumMFV = 0;
    let sumVol = 0;
    for (let j = 0; j < period; j++) {
      sumMFV += mfvs[i - j].mfv;
      sumVol += mfvs[i - j].vol;
    }
    const cmf = sumVol === 0 ? 0 : sumMFV / sumVol;
    result.push({
      time: (mfvs[i].time as unknown) as Time,
      value: Number(cmf.toFixed(4))
    });
  }

  return result;
}

export function calculateMFI(candles: Candle[], period: number): LineData<Time>[] {
  const result: LineData<Time>[] = [];
  if (candles.length < period + 1) return result;

  const typicalPrices = candles.map(c => (c.high + c.low + c.close) / 3);
  const rawMoneyFlow = candles.map((c, idx) => typicalPrices[idx] * (c.volume || 0));

  for (let i = period; i < candles.length; i++) {
    let posFlow = 0;
    let negFlow = 0;

    for (let j = 0; j < period; j++) {
      const curIdx = i - j;
      const prevIdx = curIdx - 1;
      if (typicalPrices[curIdx] > typicalPrices[prevIdx]) {
        posFlow += rawMoneyFlow[curIdx];
      } else if (typicalPrices[curIdx] < typicalPrices[prevIdx]) {
        negFlow += rawMoneyFlow[curIdx];
      }
    }

    const mr = negFlow === 0 ? 100 : posFlow / negFlow;
    const mfi = negFlow === 0 ? 100 : 100 - 100 / (1 + mr);

    result.push({
      time: (candles[i].timestamp as unknown) as Time,
      value: Number(mfi.toFixed(2))
    });
  }

  return result;
}

export function calculateAccumulationDistribution(candles: Candle[]): LineData<Time>[] {
  const result: LineData<Time>[] = [];
  let ad = 0;

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const range = c.high - c.low;
    const vol = c.volume || 0;
    const clv = range === 0 ? 0 : ((c.close - c.low) - (c.high - c.close)) / range;
    ad += clv * vol;

    result.push({
      time: (c.timestamp as unknown) as Time,
      value: Number(ad.toFixed(0))
    });
  }

  return result;
}

export function calculateAwesomeOscillator(
  candles: Candle[],
  fast: number,
  slow: number
): HistogramData<Time>[] {
  const result: HistogramData<Time>[] = [];
  if (candles.length < slow) return result;

  const medianPrices = candles.map(c => ({
    timestamp: c.timestamp,
    open: (c.high + c.low) / 2,
    high: (c.high + c.low) / 2,
    low: (c.high + c.low) / 2,
    close: (c.high + c.low) / 2,
    volume: 0
  }));

  const fastSMA = calculateSMA(medianPrices, fast);
  const slowSMA = calculateSMA(medianPrices, slow);

  const slowMap = new Map<number, number>();
  slowSMA.forEach(p => slowMap.set(Number(p.time), p.value));

  let prevVal = 0;
  fastSMA.forEach(p => {
    const t = Number(p.time);
    const slowVal = slowMap.get(t);
    if (slowVal !== undefined) {
      const ao = p.value - slowVal;
      result.push({
        time: (t as unknown) as Time,
        value: Number(ao.toFixed(4)),
        color: ao >= prevVal ? 'rgba(16, 185, 129, 0.7)' : 'rgba(244, 63, 94, 0.7)'
      });
      prevVal = ao;
    }
  });

  return result;
}

export function calculateUltimateOscillator(
  candles: Candle[],
  sPeriod: number,
  mPeriod: number,
  lPeriod: number
): LineData<Time>[] {
  const result: LineData<Time>[] = [];
  if (candles.length < lPeriod + 1) return result;

  const bps: number[] = [];
  const trs: number[] = [];

  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];
    const prev = candles[i - 1];
    const trueLow = Math.min(c.low, prev.close);
    const trueHigh = Math.max(c.high, prev.close);
    bps.push(c.close - trueLow);
    trs.push(trueHigh - trueLow);
  }

  for (let i = lPeriod - 1; i < bps.length; i++) {
    let sBP = 0;
    let sTR = 0;
    for (let j = 0; j < sPeriod; j++) {
      sBP += bps[i - j];
      sTR += trs[i - j];
    }
    const avg7 = sTR === 0 ? 0 : sBP / sTR;

    let mBP = 0;
    let mTR = 0;
    for (let j = 0; j < mPeriod; j++) {
      mBP += bps[i - j];
      mTR += trs[i - j];
    }
    const avg14 = mTR === 0 ? 0 : mBP / mTR;

    let lBP = 0;
    let lTR = 0;
    for (let j = 0; j < lPeriod; j++) {
      lBP += bps[i - j];
      lTR += trs[i - j];
    }
    const avg28 = lTR === 0 ? 0 : lBP / lTR;

    const uo = 100 * (4 * avg7 + 2 * avg14 + avg28) / (4 + 2 + 1);

    result.push({
      time: (candles[i + 1].timestamp as unknown) as Time,
      value: Number(uo.toFixed(2))
    });
  }

  return result;
}

export function calculateRVI(candles: Candle[], period: number): LineData<Time>[] {
  const result: LineData<Time>[] = [];
  if (candles.length < period + 4) return result;

  const num: number[] = [];
  const den: number[] = [];

  for (let i = 3; i < candles.length; i++) {
    const c0 = candles[i];
    const c1 = candles[i - 1];
    const c2 = candles[i - 2];
    const c3 = candles[i - 3];

    const n = ((c0.close - c0.open) + 2 * (c1.close - c1.open) + 2 * (c2.close - c2.open) + (c3.close - c3.open)) / 6;
    const d = ((c0.high - c0.low) + 2 * (c1.high - c1.low) + 2 * (c2.high - c2.low) + (c3.high - c3.low)) / 6;

    num.push(n);
    den.push(d);
  }

  for (let i = period - 1; i < num.length; i++) {
    let sumNum = 0;
    let sumDen = 0;
    for (let j = 0; j < period; j++) {
      sumNum += num[i - j];
      sumDen += den[i - j];
    }
    const rvi = sumDen === 0 ? 0 : sumNum / sumDen;
    result.push({
      time: (candles[i + 4].timestamp as unknown) as Time,
      value: Number(rvi.toFixed(4))
    });
  }

  return result;
}

export function calculateDPO(candles: Candle[], period: number): LineData<Time>[] {
  const result: LineData<Time>[] = [];
  const shift = Math.floor(period / 2) + 1;
  if (candles.length < period + shift) return result;

  const sma = calculateSMA(candles, period);
  const smaMap = new Map<number, number>();
  sma.forEach(p => smaMap.set(Number(p.time), p.value));

  for (let i = period + shift - 1; i < candles.length; i++) {
    const targetTime = candles[i - shift].timestamp;
    const smaVal = smaMap.get(targetTime);
    if (smaVal !== undefined) {
      const dpo = candles[i].close - smaVal;
      result.push({
        time: (candles[i].timestamp as unknown) as Time,
        value: Number(dpo.toFixed(4))
      });
    }
  }

  return result;
}
