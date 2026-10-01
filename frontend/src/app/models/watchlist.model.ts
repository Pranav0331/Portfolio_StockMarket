export interface WatchlistItem {
  id: number;
  stockId: number;
  symbol: string;
  companyName: string;
  exchange: string;
  currency: string;
  category: string;
  currentPrice: number | null;
  change: number | null;
  changePercent: string | null;
  previousClose: number | null;
  volume: number | null;
  displayOrder: number;
  priceAvailable: boolean;
  lastUpdated: number;
  provider: string;
  notes?: string;
}

export interface WatchlistResponse {
  items: WatchlistItem[];
  categories: string[];
  totalCount: number;
  lastRefreshed: number;
}

export interface AddWatchlistRequest {
  symbol: string;
  category?: string;
  notes?: string;
}

export interface ReorderWatchlistRequest {
  orderedIds: number[];
}
