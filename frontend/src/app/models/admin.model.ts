export interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  suspendedUsers: number;
  inactiveUsers: number;
  totalOrders: number;
  totalTransactions: number;
  totalHoldings: number;
  totalAlerts: number;
  totalWatchlistItems: number;
  timestamp: number;
}

export interface AdminUser {
  id: number;
  email: string;
  fullName: string;
  role: string;
  status: string;
  provider: string;
  createdAt: number | null;
  updatedAt: number | null;
  holdingsCount: number;
  ordersCount: number;
  transactionsCount: number;
  alertsCount: number;
  watchlistCount: number;
  virtualBalance: number;
}

export interface AdminOrder {
  id: number;
  userId: number;
  userEmail: string;
  userName: string;
  symbol: string;
  companyName: string;
  orderType: string;
  quantity: number;
  pricePerUnit: number;
  totalAmount: number;
  status: string;
  createdAt: number | null;
}

export interface AdminTransaction {
  id: number;
  userId: number;
  userEmail: string;
  userName: string;
  symbol: string;
  companyName: string;
  transactionType: string;
  quantity: number;
  pricePerUnit: number;
  totalAmount: number;
  fees: number;
  status: string;
  createdAt: number | null;
}

export interface AdminDashboardSummary {
  stats: AdminStats;
  recentUsers: AdminUser[];
  recentOrders: AdminOrder[];
  recentTransactions: AdminTransaction[];
}

export interface UpdateUserStatusRequest {
  status: string;
}

export interface UpdateUserRoleRequest {
  role: string;
}
