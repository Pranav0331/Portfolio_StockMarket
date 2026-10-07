export type MarketType = 'INDIAN' | 'US' | 'FOREX' | 'CRYPTO';
export type TradingMode = 'SCALPING' | 'INTRADAY';
export type StrategyDirection = 'LONG' | 'SHORT' | 'BOTH';
export type StrategyStatus = 'RUNNING' | 'PAUSED' | 'STOPPED';
export type AlgoSignal = 'BUY' | 'SELL' | 'WAIT';

export interface AlgoStrategy {
  id?: number;
  userId?: number;
  name: string;
  symbol: string;
  marketType: MarketType;
  tradingMode: TradingMode;
  timeframe: string; // '1m' | '5m' | '15m' | '30m' | '1h'
  direction: StrategyDirection;
  
  // Indicators
  useEma9: boolean;
  ema9Period: number;
  useEma21: boolean;
  ema21Period: number;
  useRsi: boolean;
  rsiPeriod: number;
  rsiLongThreshold: number;
  rsiShortThreshold: number;
  useMacd: boolean;
  macdFast: number;
  macdSlow: number;
  macdSignal: number;
  useBollinger: boolean;
  bollingerPeriod: number;
  bollingerStdDev: number;

  // Conditions
  condEmaCross: boolean;
  condRsiThreshold: boolean;
  condMacdDirection: boolean;
  condBollingerBounce: boolean;

  // Risk Management
  isPaperTrading: boolean;
  virtualCapital: number;
  riskPerTradePercent: number;
  leverage: number;
  quantity: number;
  stopLossPercent: number;
  takeProfitPercent: number;
  maxOpenPositions: number;
  dailyLossLimit: number;

  // State & Metrics
  status: StrategyStatus;
  lastSignal?: AlgoSignal;
  lastSignalReason?: string;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  totalPnl: number;
  lastEvaluatedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AlgoEvaluationResult {
  strategyId?: number;
  symbol: string;
  currentPrice: number;
  trend?: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  marketTrend?: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  signal: AlgoSignal;
  confidence: number;
  riskLevel?: 'LOW' | 'MODERATE' | 'HIGH' | 'MEDIUM';
  reasons: string[];
  activeIndicators: string[];
  tradeExecuted?: boolean;
  executionMessage?: string;
  orderId?: number;
  positionId?: number;
  requiredMargin?: number;
  positionSize?: number;
  maxRiskAmount?: number;
  evaluatedAt?: string;
  timestamp?: string;
  isMarketDataAvailable?: boolean;
  statusMessage?: string;
}

export interface AlgoPerformanceSummary {
  strategyId: number;
  strategyName?: string;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalPnl: number;
  averageProfit: number;
  averageLoss: number;
  profitFactor: number;
  maxDrawdown: number;
  currency?: string;
}

export interface AlgoTradeLog {
  id: number;
  strategyId: number;
  strategyName?: string;
  symbol: string;
  action: 'BUY' | 'SELL' | 'CLOSE' | 'WAIT' | 'SKIPPED';
  signal: AlgoSignal;
  price: number;
  quantity: number;
  leverage?: number;
  pnl?: number;
  confidence: number;
  trend?: string;
  reason?: string;
  reasons?: string;
  orderId?: number;
  positionId?: number;
  status: string;
  executedAt?: string;
  createdAt?: string;
}
