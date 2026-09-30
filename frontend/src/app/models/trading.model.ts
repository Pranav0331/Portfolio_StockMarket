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
}
