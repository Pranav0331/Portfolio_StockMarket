export type OrderType = 'BUY' | 'SELL';
export type OrderStatus = 'PENDING' | 'EXECUTED' | 'CANCELLED' | 'REJECTED';

export interface TradeRequest {
  symbol: string;
  quantity: number;
}

export interface TradeResponse {
  orderId: number;
  transactionId: number;
  symbol: string;
  companyName: string;
  orderType: OrderType;
  orderStatus: OrderStatus;
  quantity: number;
  executionPrice: number;
  totalAmount: number;
  remainingCashBalance: number;
  currentHoldingQuantity: number;
  executedAt: string;
  message: string;
}

export interface VirtualWallet {
  cashBalance: number;
  totalInvested: number;
  totalPortfolioValue: number;
  currency: string;
}

export interface UserHolding {
  holdingId: number;
  symbol: string;
  companyName: string;
  exchange: string;
  currency: string;
  quantity: number;
  averageBuyPrice: number;
  totalInvested: number;
  currentPrice: number | null;
  currentValue: number | null;
  unrealizedPnL: number | null;
  unrealizedPnLPercent: number | null;
  allocationPercent?: number;
  priceAvailable?: boolean;
}

export interface PortfolioSummary {
  cashBalance: number;
  availableCash?: number;
  totalInvested: number;
  totalHoldingsMarketValue: number;
  totalPortfolioValue: number;
  totalUnrealizedPnL: number;
  totalUnrealizedPnLPercent: number;
  totalHoldingsCount: number;
  cashAllocationPercent: number;
  holdings: UserHolding[];
  todayPnL?: number;
  todayPnLPercent?: number;
}

export interface TransactionItem {
  transactionId: number;
  orderId?: number;
  symbol: string;
  companyName: string;
  exchange: string;
  currency: string;
  type: 'BUY' | 'SELL';
  status: string;
  quantity: number;
  executionPrice: number;
  totalAmount: number;
  fees?: number;
  executedAt: string;
  pnl?: number;
  pnlPercent?: number;
  avgBuyPrice?: number;
  currentPrice?: number;
}

export interface TransactionPageResponse {
  content: TransactionItem[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}

export interface TransactionFilterParams {
  type?: 'BUY' | 'SELL' | 'ALL';
  symbol?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  size?: number;
  sort?: 'desc' | 'asc';
}

export interface OrderItem {
  id: number;
  symbol: string;
  companyName: string;
  exchange: string;
  currency: string;
  orderType: OrderType;
  orderStatus: OrderStatus;
  quantity: number;
  price: number;
  executedPrice: number;
  totalAmount: number;
  executedAt?: string;
  createdAt: string;
}

export interface OrderPageResponse {
  content: OrderItem[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}

export interface OrderFilterParams {
  type?: 'BUY' | 'SELL' | 'ALL';
  status?: 'EXECUTED' | 'PENDING' | 'CANCELLED' | 'REJECTED' | 'ALL';
  symbol?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  size?: number;
  sort?: 'desc' | 'asc';
}

