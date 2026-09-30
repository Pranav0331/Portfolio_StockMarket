export type IndicatorCategory =
  | 'trend'
  | 'momentum'
  | 'volatility'
  | 'volume'
  | 'moving_averages'
  | 'oscillators';

export interface IndicatorParamField {
  key: string;
  label: string;
  type: 'number' | 'color' | 'select';
  default: any;
  min?: number;
  max?: number;
  step?: number;
  options?: { label: string; value: any }[];
}

export interface IndicatorDefinition {
  id: string;
  name: string;
  shortName: string;
  category: IndicatorCategory;
  description: string;
  defaultParams: Record<string, any>;
  paramSchema: IndicatorParamField[];
  defaultColor: string;
  isOverlay: boolean;
  tags: string[];
}

export interface ActiveIndicator {
  instanceId: string;
  defId: string;
  name: string;
  shortName: string;
  category: IndicatorCategory;
  enabled: boolean;
  params: Record<string, any>;
  color: string;
  lineWidth: number;
  isOverlay: boolean;
}

export const INDICATOR_CATEGORIES: { id: IndicatorCategory | 'all'; label: string }[] = [
  { id: 'all', label: 'All Indicators' },
  { id: 'moving_averages', label: 'Moving Averages' },
  { id: 'trend', label: 'Trend' },
  { id: 'momentum', label: 'Momentum' },
  { id: 'volatility', label: 'Volatility' },
  { id: 'volume', label: 'Volume' },
  { id: 'oscillators', label: 'Oscillators' }
];

export const INDICATOR_LIBRARY: IndicatorDefinition[] = [
  // ==========================================
  // 1. MOVING AVERAGES
  // ==========================================
  {
    id: 'sma',
    name: 'Simple Moving Average',
    shortName: 'SMA',
    category: 'moving_averages',
    description: 'Calculates the average price over a specified number of recent periods.',
    defaultParams: { period: 20 },
    paramSchema: [
      { key: 'period', label: 'Period (Length)', type: 'number', default: 20, min: 1, max: 500, step: 1 }
    ],
    defaultColor: '#3b82f6',
    isOverlay: true,
    tags: ['ma', 'average', 'trend', 'simple']
  },
  {
    id: 'ema',
    name: 'Exponential Moving Average',
    shortName: 'EMA',
    category: 'moving_averages',
    description: 'Places a greater weight and significance on the most recent data points.',
    defaultParams: { period: 50 },
    paramSchema: [
      { key: 'period', label: 'Period (Length)', type: 'number', default: 50, min: 1, max: 500, step: 1 }
    ],
    defaultColor: '#f59e0b',
    isOverlay: true,
    tags: ['ma', 'exponential', 'lag', 'trend']
  },
  {
    id: 'wma',
    name: 'Weighted Moving Average',
    shortName: 'WMA',
    category: 'moving_averages',
    description: 'Assigns linearly decreasing weights from the newest to oldest price bars.',
    defaultParams: { period: 20 },
    paramSchema: [
      { key: 'period', label: 'Period (Length)', type: 'number', default: 20, min: 1, max: 500, step: 1 }
    ],
    defaultColor: '#10b981',
    isOverlay: true,
    tags: ['ma', 'weighted', 'linear']
  },
  {
    id: 'hma',
    name: 'Hull Moving Average',
    shortName: 'HMA',
    category: 'moving_averages',
    description: 'Extremely responsive moving average that significantly eliminates lag while smoothing price.',
    defaultParams: { period: 16 },
    paramSchema: [
      { key: 'period', label: 'Period (Length)', type: 'number', default: 16, min: 2, max: 200, step: 1 }
    ],
    defaultColor: '#8b5cf6',
    isOverlay: true,
    tags: ['ma', 'hull', 'lag reduction']
  },
  {
    id: 'dema',
    name: 'Double Exponential Moving Average',
    shortName: 'DEMA',
    category: 'moving_averages',
    description: 'Combines two exponential moving averages to produce a faster moving average line.',
    defaultParams: { period: 20 },
    paramSchema: [
      { key: 'period', label: 'Period (Length)', type: 'number', default: 20, min: 2, max: 300, step: 1 }
    ],
    defaultColor: '#ec4899',
    isOverlay: true,
    tags: ['ma', 'double', 'fast']
  },
  {
    id: 'tema',
    name: 'Triple Exponential Moving Average',
    shortName: 'TEMA',
    category: 'moving_averages',
    description: 'Uses three exponential moving averages to drastically minimize lag in volatile markets.',
    defaultParams: { period: 20 },
    paramSchema: [
      { key: 'period', label: 'Period (Length)', type: 'number', default: 20, min: 3, max: 300, step: 1 }
    ],
    defaultColor: '#06b6d4',
    isOverlay: true,
    tags: ['ma', 'triple', 'fast']
  },

  // ==========================================
  // 2. TREND
  // ==========================================
  {
    id: 'supertrend',
    name: 'Supertrend',
    shortName: 'Supertrend',
    category: 'trend',
    description: 'Trend-following overlay indicator based on Average True Range (ATR) with adaptive stops.',
    defaultParams: { period: 10, multiplier: 3 },
    paramSchema: [
      { key: 'period', label: 'ATR Period', type: 'number', default: 10, min: 1, max: 100, step: 1 },
      { key: 'multiplier', label: 'ATR Multiplier', type: 'number', default: 3, min: 0.5, max: 10, step: 0.1 }
    ],
    defaultColor: '#10b981',
    isOverlay: true,
    tags: ['trend', 'trailing stop', 'atr', 'super']
  },
  {
    id: 'psar',
    name: 'Parabolic SAR',
    shortName: 'PSAR',
    category: 'trend',
    description: 'Stop-and-reversal indicator identifying potential trend direction and entry/exit points.',
    defaultParams: { step: 0.02, maxStep: 0.2 },
    paramSchema: [
      { key: 'step', label: 'Acceleration Factor Step', type: 'number', default: 0.02, min: 0.005, max: 0.1, step: 0.005 },
      { key: 'maxStep', label: 'Maximum Acceleration', type: 'number', default: 0.2, min: 0.05, max: 0.5, step: 0.05 }
    ],
    defaultColor: '#f59e0b',
    isOverlay: true,
    tags: ['trend', 'sar', 'reversal', 'dots']
  },
  {
    id: 'ichimoku',
    name: 'Ichimoku Baseline (Kijun-sen)',
    shortName: 'Ichimoku',
    category: 'trend',
    description: 'Midpoint of highest high and lowest low over the past 26 periods as a key trend filter.',
    defaultParams: { period: 26 },
    paramSchema: [
      { key: 'period', label: 'Baseline Period', type: 'number', default: 26, min: 5, max: 100, step: 1 }
    ],
    defaultColor: '#ef4444',
    isOverlay: true,
    tags: ['ichimoku', 'cloud', 'trend', 'kijun']
  },
  {
    id: 'adx',
    name: 'Average Directional Index (ADX)',
    shortName: 'ADX',
    category: 'trend',
    description: 'Measures the strength of a trend regardless of whether price is moving up or down.',
    defaultParams: { period: 14 },
    paramSchema: [
      { key: 'period', label: 'ADX Period', type: 'number', default: 14, min: 2, max: 100, step: 1 }
    ],
    defaultColor: '#6366f1',
    isOverlay: false,
    tags: ['trend strength', 'dmi', 'direction']
  },
  {
    id: 'aroon',
    name: 'Aroon Oscillator',
    shortName: 'Aroon',
    category: 'trend',
    description: 'Calculates the time between highs and lows to detect the beginning of new trends.',
    defaultParams: { period: 14 },
    paramSchema: [
      { key: 'period', label: 'Aroon Period', type: 'number', default: 14, min: 2, max: 100, step: 1 }
    ],
    defaultColor: '#14b8a6',
    isOverlay: false,
    tags: ['aroon', 'trend', 'cycle']
  },
  {
    id: 'zigzag',
    name: 'Zig Zag Trend Line',
    shortName: 'ZigZag',
    category: 'trend',
    description: 'Filters out market noise by connecting swing highs and swing lows exceeding a threshold.',
    defaultParams: { deviation: 5 },
    paramSchema: [
      { key: 'deviation', label: 'Deviation %', type: 'number', default: 5, min: 1, max: 20, step: 0.5 }
    ],
    defaultColor: '#eab308',
    isOverlay: true,
    tags: ['swings', 'elliott', 'noise filter']
  },

  // ==========================================
  // 3. VOLATILITY
  // ==========================================
  {
    id: 'bb',
    name: 'Bollinger Bands',
    shortName: 'BB',
    category: 'volatility',
    description: 'Envelope plotted at a standard deviation level above and below a central simple moving average.',
    defaultParams: { period: 20, stdDev: 2 },
    paramSchema: [
      { key: 'period', label: 'Period', type: 'number', default: 20, min: 5, max: 100, step: 1 },
      { key: 'stdDev', label: 'Std Dev Multiplier', type: 'number', default: 2, min: 0.5, max: 5, step: 0.1 }
    ],
    defaultColor: '#818cf8',
    isOverlay: true,
    tags: ['bands', 'squeeze', 'volatility', 'standard deviation']
  },
  {
    id: 'atr',
    name: 'Average True Range (ATR)',
    shortName: 'ATR',
    category: 'volatility',
    description: 'Measures market volatility by decomposing the entire range of an asset price for that period.',
    defaultParams: { period: 14 },
    paramSchema: [
      { key: 'period', label: 'Period', type: 'number', default: 14, min: 1, max: 100, step: 1 }
    ],
    defaultColor: '#f97316',
    isOverlay: false,
    tags: ['volatility', 'range', 'stop loss']
  },
  {
    id: 'keltner',
    name: 'Keltner Channels',
    shortName: 'Keltner',
    category: 'volatility',
    description: 'Volatility-based envelopes set above and below an exponential moving average using ATR.',
    defaultParams: { period: 20, multiplier: 2 },
    paramSchema: [
      { key: 'period', label: 'EMA Period', type: 'number', default: 20, min: 5, max: 100, step: 1 },
      { key: 'multiplier', label: 'ATR Multiplier', type: 'number', default: 2, min: 0.5, max: 5, step: 0.1 }
    ],
    defaultColor: '#a855f7',
    isOverlay: true,
    tags: ['channels', 'volatility', 'envelope']
  },
  {
    id: 'donchian',
    name: 'Donchian Channels',
    shortName: 'Donchian',
    category: 'volatility',
    description: 'Forms a channel using highest high and lowest low over the past N periods (Turtle Trading).',
    defaultParams: { period: 20 },
    paramSchema: [
      { key: 'period', label: 'Period', type: 'number', default: 20, min: 5, max: 100, step: 1 }
    ],
    defaultColor: '#0ea5e9',
    isOverlay: true,
    tags: ['breakout', 'channel', 'high low']
  },
  {
    id: 'stddev',
    name: 'Standard Deviation',
    shortName: 'StdDev',
    category: 'volatility',
    description: 'Statistical dispersion metric quantifying price fluctuation around the moving average.',
    defaultParams: { period: 20 },
    paramSchema: [
      { key: 'period', label: 'Period', type: 'number', default: 20, min: 5, max: 100, step: 1 }
    ],
    defaultColor: '#14b8a6',
    isOverlay: false,
    tags: ['dispersion', 'risk', 'volatility']
  },
  {
    id: 'histvol',
    name: 'Historical Volatility (HV)',
    shortName: 'HistVol',
    category: 'volatility',
    description: 'Annualized percentage standard deviation of log returns over historical price bars.',
    defaultParams: { period: 30 },
    paramSchema: [
      { key: 'period', label: 'Period', type: 'number', default: 30, min: 5, max: 100, step: 1 }
    ],
    defaultColor: '#fb7185',
    isOverlay: false,
    tags: ['annualized', 'options', 'historical']
  },

  // ==========================================
  // 4. MOMENTUM
  // ==========================================
  {
    id: 'rsi',
    name: 'Relative Strength Index',
    shortName: 'RSI',
    category: 'momentum',
    description: 'Evaluates overbought or oversold conditions in the price of a stock or asset.',
    defaultParams: { period: 14, overbought: 70, oversold: 30 },
    paramSchema: [
      { key: 'period', label: 'RSI Period', type: 'number', default: 14, min: 2, max: 100, step: 1 },
      { key: 'overbought', label: 'Overbought Level', type: 'number', default: 70, min: 50, max: 95, step: 1 },
      { key: 'oversold', label: 'Oversold Level', type: 'number', default: 30, min: 5, max: 50, step: 1 }
    ],
    defaultColor: '#8b5cf6',
    isOverlay: false,
    tags: ['momentum', 'oscillator', 'overbought', 'oversold']
  },
  {
    id: 'macd',
    name: 'Moving Average Convergence Divergence',
    shortName: 'MACD',
    category: 'momentum',
    description: 'Shows the relationship between two exponential moving averages of an asset price.',
    defaultParams: { fast: 12, slow: 26, signal: 9 },
    paramSchema: [
      { key: 'fast', label: 'Fast Period', type: 'number', default: 12, min: 2, max: 50, step: 1 },
      { key: 'slow', label: 'Slow Period', type: 'number', default: 26, min: 5, max: 100, step: 1 },
      { key: 'signal', label: 'Signal Period', type: 'number', default: 9, min: 2, max: 50, step: 1 }
    ],
    defaultColor: '#3b82f6',
    isOverlay: false,
    tags: ['momentum', 'histogram', 'divergence', 'crossover']
  },
  {
    id: 'stoch',
    name: 'Stochastic Oscillator',
    shortName: 'Stoch',
    category: 'momentum',
    description: 'Compares a specific closing price of an asset to a range of its prices over a given period.',
    defaultParams: { kPeriod: 14, dPeriod: 3 },
    paramSchema: [
      { key: 'kPeriod', label: '%K Period', type: 'number', default: 14, min: 2, max: 100, step: 1 },
      { key: 'dPeriod', label: '%D Period', type: 'number', default: 3, min: 1, max: 20, step: 1 }
    ],
    defaultColor: '#06b6d4',
    isOverlay: false,
    tags: ['stochastic', 'k d', 'overbought']
  },
  {
    id: 'williams_r',
    name: 'Williams %R',
    shortName: 'Williams %R',
    category: 'momentum',
    description: 'Momentum indicator that measures overbought and oversold levels, oscillating between 0 and -100.',
    defaultParams: { period: 14 },
    paramSchema: [
      { key: 'period', label: 'Period', type: 'number', default: 14, min: 2, max: 100, step: 1 }
    ],
    defaultColor: '#f43f5e',
    isOverlay: false,
    tags: ['williams', 'momentum', 'oversold']
  },
  {
    id: 'cci',
    name: 'Commodity Channel Index',
    shortName: 'CCI',
    category: 'momentum',
    description: 'Versatile indicator that can be used to identify a new trend or warn of extreme conditions.',
    defaultParams: { period: 20 },
    paramSchema: [
      { key: 'period', label: 'Period', type: 'number', default: 20, min: 5, max: 100, step: 1 }
    ],
    defaultColor: '#eab308',
    isOverlay: false,
    tags: ['cci', 'channel', 'mean deviation']
  },
  {
    id: 'roc',
    name: 'Rate of Change (ROC)',
    shortName: 'ROC',
    category: 'momentum',
    description: 'Pure momentum oscillator that measures the percent change in price from one period to the next.',
    defaultParams: { period: 12 },
    paramSchema: [
      { key: 'period', label: 'Period', type: 'number', default: 12, min: 1, max: 100, step: 1 }
    ],
    defaultColor: '#10b981',
    isOverlay: false,
    tags: ['velocity', 'percentage', 'speed']
  },

  // ==========================================
  // 5. VOLUME
  // ==========================================
  {
    id: 'volume_sma',
    name: 'Volume Moving Average',
    shortName: 'Vol SMA',
    category: 'volume',
    description: 'Plots the rolling simple moving average of traded volume directly on the volume pane.',
    defaultParams: { period: 20 },
    paramSchema: [
      { key: 'period', label: 'Period', type: 'number', default: 20, min: 2, max: 100, step: 1 }
    ],
    defaultColor: '#38bdf8',
    isOverlay: false,
    tags: ['volume', 'liquidity', 'average']
  },
  {
    id: 'vwap',
    name: 'Volume Weighted Average Price (VWAP)',
    shortName: 'VWAP',
    category: 'volume',
    description: 'Benchmark that gives the true average price a security has traded at throughout the session based on volume.',
    defaultParams: {},
    paramSchema: [],
    defaultColor: '#ec4899',
    isOverlay: true,
    tags: ['vwap', 'institutional', 'benchmark', 'volume price']
  },
  {
    id: 'obv',
    name: 'On-Balance Volume (OBV)',
    shortName: 'OBV',
    category: 'volume',
    description: 'Uses volume flow to predict changes in stock price by accumulating volume on up and down days.',
    defaultParams: {},
    paramSchema: [],
    defaultColor: '#10b981',
    isOverlay: false,
    tags: ['obv', 'cumulative volume', 'flow']
  },
  {
    id: 'cmf',
    name: 'Chaikin Money Flow (CMF)',
    shortName: 'CMF',
    category: 'volume',
    description: 'Measures the amount of Money Flow Volume over a specific period to gauge institutional pressure.',
    defaultParams: { period: 20 },
    paramSchema: [
      { key: 'period', label: 'Period', type: 'number', default: 20, min: 5, max: 100, step: 1 }
    ],
    defaultColor: '#6366f1',
    isOverlay: false,
    tags: ['chaikin', 'money flow', 'accumulation']
  },
  {
    id: 'mfi',
    name: 'Money Flow Index (MFI)',
    shortName: 'MFI',
    category: 'volume',
    description: 'Volume-weighted RSI that measures the inflow and outflow of money into an asset over time.',
    defaultParams: { period: 14 },
    paramSchema: [
      { key: 'period', label: 'Period', type: 'number', default: 14, min: 2, max: 100, step: 1 }
    ],
    defaultColor: '#f59e0b',
    isOverlay: false,
    tags: ['volume rsi', 'flow', 'pressure']
  },
  {
    id: 'ad',
    name: 'Accumulation / Distribution (A/D)',
    shortName: 'A/D Line',
    category: 'volume',
    description: 'Cumulative indicator measuring whether investors are accumulating (buying) or distributing (selling).',
    defaultParams: {},
    paramSchema: [],
    defaultColor: '#a855f7',
    isOverlay: false,
    tags: ['accumulation', 'distribution', 'smart money']
  },

  // ==========================================
  // 6. OSCILLATORS
  // ==========================================
  {
    id: 'ao',
    name: 'Awesome Oscillator (AO)',
    shortName: 'AO',
    category: 'oscillators',
    description: 'Bill Williams indicator that measures market momentum using the difference between a 34 and 5 period SMA.',
    defaultParams: { fast: 5, slow: 34 },
    paramSchema: [
      { key: 'fast', label: 'Fast Period', type: 'number', default: 5, min: 2, max: 50, step: 1 },
      { key: 'slow', label: 'Slow Period', type: 'number', default: 34, min: 10, max: 100, step: 1 }
    ],
    defaultColor: '#10b981',
    isOverlay: false,
    tags: ['bill williams', 'awesome', 'median']
  },
  {
    id: 'uo',
    name: 'Ultimate Oscillator',
    shortName: 'UO',
    category: 'oscillators',
    description: 'Combines short, medium, and long-term price action across three different timeframes to avoid false signals.',
    defaultParams: { short: 7, mid: 14, long: 28 },
    paramSchema: [
      { key: 'short', label: 'Short Period', type: 'number', default: 7, min: 2, max: 20, step: 1 },
      { key: 'mid', label: 'Mid Period', type: 'number', default: 14, min: 5, max: 50, step: 1 },
      { key: 'long', label: 'Long Period', type: 'number', default: 28, min: 10, max: 100, step: 1 }
    ],
    defaultColor: '#3b82f6',
    isOverlay: false,
    tags: ['larry williams', 'multi timeframe', 'oscillator']
  },
  {
    id: 'rvi',
    name: 'Relative Vigor Index (RVI)',
    shortName: 'RVI',
    category: 'oscillators',
    description: 'Measures the conviction of a recent price action and the likelihood that it will continue.',
    defaultParams: { period: 10 },
    paramSchema: [
      { key: 'period', label: 'Period', type: 'number', default: 10, min: 2, max: 50, step: 1 }
    ],
    defaultColor: '#ec4899',
    isOverlay: false,
    tags: ['vigor', 'energy', 'closing vs opening']
  },
  {
    id: 'dpo',
    name: 'Detrended Price Oscillator (DPO)',
    shortName: 'DPO',
    category: 'oscillators',
    description: 'Removes trend from price to make it easier to identify short-term cycles and overbought/oversold levels.',
    defaultParams: { period: 20 },
    paramSchema: [
      { key: 'period', label: 'Period', type: 'number', default: 20, min: 5, max: 100, step: 1 }
    ],
    defaultColor: '#06b6d4',
    isOverlay: false,
    tags: ['detrend', 'cycle', 'cycles']
  }
];
