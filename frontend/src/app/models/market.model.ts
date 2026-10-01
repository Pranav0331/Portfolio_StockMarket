export interface StockQuote {
  symbol: string;
  name?: string | null;
  price: number;
  change: number;
  changePercent: string;
  previousClose?: number | null;
  open?: number | null;
  high?: number | null;
  low?: number | null;
  volume?: number | null;
  latestTradingDay?: string | null;
  timestamp?: number | null;
}

export interface MarketPrice {
  symbol: string;
  price: number;
  change: number;
  changePercent: string;
  timestamp: number;
}

export interface Candle {
  timestamp: number;
  datetime?: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface CandleSeries {
  symbol: string;
  interval: string;
  currency?: string;
  exchange?: string;
  type?: string;
  candles: Candle[];
}

export interface StockSearchItem {
  symbol: string;
  name: string;
  type: string;
  region: string;
  currency: string;
  matchScore: string;
}

export interface StockSearchResponse {
  bestMatches: StockSearchItem[];
  query: string;
}

export interface FundamentalData {
  symbol: string;
  companyName: string;
  exchange?: string | null;
  currency?: string | null;
  provider?: string | null;
  sector?: string | null;
  industry?: string | null;
  description?: string | null;
  ceo?: string | null;
  website?: string | null;
  marketCap?: number | null;
  peRatio?: number | null;
  eps?: number | null;
  roe?: number | null;
  revenue?: number | null;
  netIncome?: number | null;
  dividendYield?: number | null;
  fiftyTwoWeekHigh?: number | null;
  fiftyTwoWeekLow?: number | null;
  lastUpdated?: number | null;
}

