export type AlertConditionType = 'ABOVE' | 'BELOW';
export type AlertStatusType = 'ACTIVE' | 'TRIGGERED' | 'DISABLED';

export interface AlertItem {
  id: number;
  stockId: number | null;
  symbol: string;
  companyName: string;
  exchange: string;
  currency: string;
  targetPrice: number;
  conditionType: AlertConditionType;
  status: AlertStatusType;
  currentPrice: number | null;
  priceAvailable: boolean;
  triggeredPrice: number | null;
  triggeredAt: number | null;
  createdAt: number;
  updatedAt: number;
  provider: string;
  notes?: string;
  message?: string;
}

export interface AlertsResponse {
  alerts: AlertItem[];
  totalCount: number;
  activeCount: number;
  triggeredCount: number;
  disabledCount: number;
  lastEvaluatedAt: number;
}

export interface CreateAlertRequest {
  symbol: string;
  condition: AlertConditionType;
  targetPrice: number;
  notes?: string;
}

export interface UpdateAlertRequest {
  condition?: AlertConditionType;
  targetPrice?: number;
  status?: AlertStatusType;
  notes?: string;
}
