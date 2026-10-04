export type OrderType = 'BUY' | 'SELL';
export type OrderStatus = 'PENDING' | 'EXECUTED' | 'CANCELLED' | 'REJECTED';
export type TradingMode = 'SCALPING' | 'INTRADAY' | 'SWING' | 'LONG_TERM';
export type PositionSide = 'LONG' | 'SHORT';
export type PositionStatus = 'OPEN' | 'CLOSED';

export interface TradeRequest {
  symbol: string;
  quantity: number;
  tradingMode?: TradingMode;
  side?: PositionSide;
  leverage?: number;
  stopLoss?: number;
  takeProfit?: number;
}

export interface TradeResponse {
  orderId: number;
  transactionId: number;
  positionId?: number;
  symbol: string;
  companyName: string;
  orderType: OrderType;
  positionSide?: PositionSide;
  orderStatus: OrderStatus;
  tradingMode?: TradingMode;
  quantity: number;
  executionPrice: number;
  totalAmount: number;
  leverage?: number;
  marginUsed?: number;
  stopLoss?: number;
  takeProfit?: number;
  remainingCashBalance: number;
  currentHoldingQuantity: number;
  executedAt: string;
  message: string;
}

export interface PositionItem {
  id: number;
  symbol: string;
  companyName: string;
  exchange: string;
  currency: string;
  side: PositionSide;
  tradingMode: TradingMode;
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  leverage: number;
  marginUsed: number;
  positionValue: number;
  unrealizedPnl?: number | null;
  unrealizedPnlPercent?: number | null;
  stopLoss?: number | null;
  takeProfit?: number | null;
  status: PositionStatus;
  closePrice?: number | null;
  closeTime?: string | null;
  realizedPnl?: number | null;
  createdAt: string;
}

export interface VirtualWallet {
  cashBalance: number;
  totalInvested: number;
  totalPortfolioValue: number;
  currency: string;
  marginUsed?: number;
  floatingPnl?: number;
  freeMargin?: number;
  marginLevelPercent?: number;
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
  positionId?: number;
  symbol: string;
  companyName: string;
  exchange: string;
  currency: string;
  type: 'BUY' | 'SELL';
  status: string;
  tradingMode?: TradingMode | string;
  positionSide?: PositionSide | string;
  leverage?: number;
  marginUsed?: number;
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
  tradingMode?: TradingMode | 'ALL';
  symbol?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  size?: number;
  sort?: 'desc' | 'asc';
}

export interface OrderItem {
  id: number;
  positionId?: number;
  symbol: string;
  companyName: string;
  exchange: string;
  currency: string;
  orderType: OrderType;
  orderStatus: OrderStatus;
  tradingMode?: TradingMode | string;
  positionSide?: PositionSide | string;
  leverage?: number;
  marginUsed?: number;
  stopLoss?: number | null;
  takeProfit?: number | null;
  realizedPnl?: number | null;
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
  tradingMode?: TradingMode | 'ALL';
  symbol?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  size?: number;
  sort?: 'desc' | 'asc';
}
