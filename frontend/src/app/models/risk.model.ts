export interface RiskExposure {
  totalInvested: number;
  equityMarketValue: number;
  cashBalance: number;
  totalPortfolioValue: number;
  equityAllocationPercent: number;
  cashAllocationPercent: number;
  var95DailyAmount: number;
  var95DailyPercent: number;
}

export interface HoldingRisk {
  holdingId: number;
  symbol: string;
  companyName: string;
  exchange: string;
  currency: string;
  quantity: number;
  currentPrice: number;
  currentValue: number;
  weightPercent: number;
  annualizedVolatilityPercent: number | null;
  maxDrawdownPercent: number | null;
  var95Daily: number | null;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  riskRating: string;
  dataAvailable: boolean;
}

export interface HistoricalRiskPoint {
  timestamp: number;
  date: string;
  portfolioValueIndex: number;
  drawdownPercent: number;
  rollingVolatilityPercent: number;
}

export interface PortfolioRisk {
  exposure: RiskExposure;
  annualizedVolatilityPercent: number;
  maxDrawdownPercent: number;
  herfindahlHirschmanIndex: number;
  top1HoldingWeightPercent: number;
  top3HoldingWeightPercent: number;
  effectiveNumberOfAssets: number;
  diversificationRating: string;
  portfolioBeta: number | null;
  benchmarkSymbol: string;
  benchmarkAvailable: boolean;
  holdings: HoldingRisk[];
  historicalRiskSeries: HistoricalRiskPoint[];
  calculationTimestamp: number;
  dataSource: string;
  emptyPortfolio: boolean;
  dataAvailable: boolean;
  statusMessage: string;
}
