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
