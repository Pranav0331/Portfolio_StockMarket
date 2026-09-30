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
