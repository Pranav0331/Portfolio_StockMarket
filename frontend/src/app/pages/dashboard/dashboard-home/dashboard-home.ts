import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../services/auth.service';
import { PortfolioService } from '../../../services/portfolio.service';
import { TradingService } from '../../../services/trading.service';
import { TransactionService } from '../../../services/transaction.service';
import { OrderService } from '../../../services/order.service';
import { WatchlistService } from '../../../services/watchlist.service';
import { PortfolioSummary, UserHolding, TransactionItem, OrderItem } from '../../../models/trading.model';
import { WatchlistItem, WatchlistResponse } from '../../../models/watchlist.model';

@Component({
  selector: 'app-dashboard-home',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './dashboard-home.html',
  styleUrl: './dashboard-home.css'
})
export class DashboardHomeComponent implements OnInit {
  readonly authService = inject(AuthService);
  private readonly portfolioService = inject(PortfolioService);
  readonly tradingService = inject(TradingService);
  private readonly transactionService = inject(TransactionService);
  private readonly orderService = inject(OrderService);
  private readonly watchlistService = inject(WatchlistService);
  private readonly router = inject(Router);

  // Core Data Signals
  readonly portfolio = signal<PortfolioSummary | null>(null);
  readonly holdings = signal<UserHolding[]>([]);
  readonly watchlist = signal<WatchlistItem[]>([]);
  readonly recentTransactions = signal<TransactionItem[]>([]);
  readonly recentOrders = signal<OrderItem[]>([]);
  readonly activeTab = signal<'indices' | 'gainers' | 'losers' | 'volume'>('indices');

  readonly isLoading = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  // Manage Paper Balance Modal State
  readonly showManageBalanceModal = signal<boolean>(false);
  readonly balanceActionTab = signal<'deposit' | 'reset'>('deposit');
  readonly depositAmount = signal<number>(10000);
  readonly resetTargetAmount = signal<number>(100000);
  readonly isManagingBalance = signal<boolean>(false);
  readonly manageBalanceSuccess = signal<string | null>(null);
  readonly manageBalanceError = signal<string | null>(null);

  ngOnInit(): void {
    this.loadDashboardData();
  }

  loadDashboardData(): void {
    this.isLoading.set(true);
    this.error.set(null);

    // 1. Load Portfolio & Holdings
    this.portfolioService.getPortfolio().subscribe({
      next: (res) => {
        this.portfolio.set(res);
        this.holdings.set(res?.holdings || []);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.error.set(err?.error?.message || 'Failed to load portfolio telemetry.');
      }
    });

    // 2. Load Virtual Wallet
    this.tradingService.getWallet().subscribe({ error: () => {} });

    // 3. Load Recent Transactions (Top 5)
    this.transactionService.getTransactions({ page: 0, size: 5, sort: 'desc' }).subscribe({
      next: (res) => {
        this.recentTransactions.set(res?.content || []);
      },
      error: () => {}
    });

    // 4. Load Recent Orders (Top 5)
    this.orderService.getOrders({ page: 0, size: 5, sort: 'desc' }).subscribe({
      next: (res) => {
        this.recentOrders.set(res?.content || []);
      },
      error: () => {}
    });

    // 5. Load Watchlist
    this.watchlistService.getWatchlist().subscribe({
      next: (res) => {
        this.watchlist.set(res?.items || []);
      },
      error: () => {}
    });
  }

  refreshDashboard(): void {
    this.loadDashboardData();
  }

  setActiveTab(tab: 'indices' | 'gainers' | 'losers' | 'volume'): void {
    this.activeTab.set(tab);
  }

  isPositiveChange(changePercent?: string | null): boolean {
    if (!changePercent) return true;
    return !changePercent.trim().startsWith('-');
  }

  // Manage Paper Balance Modal Controls
  openManageBalanceModal(action: 'deposit' | 'reset' = 'deposit'): void {
    this.balanceActionTab.set(action);
    this.manageBalanceError.set(null);
    this.manageBalanceSuccess.set(null);
    this.showManageBalanceModal.set(true);
  }

  closeManageBalanceModal(): void {
    this.showManageBalanceModal.set(false);
    this.manageBalanceError.set(null);
    this.manageBalanceSuccess.set(null);
  }

  setDepositPreset(amount: number): void {
    this.depositAmount.set(amount);
  }

  setResetPreset(amount: number): void {
    this.resetTargetAmount.set(amount);
  }

  submitDeposit(): void {
    const amount = Number(this.depositAmount());
    if (!amount || amount <= 0) {
      this.manageBalanceError.set('Please enter a valid deposit amount greater than 0.');
      return;
    }

    this.isManagingBalance.set(true);
    this.manageBalanceError.set(null);
    this.manageBalanceSuccess.set(null);

    this.tradingService.depositCash(amount).subscribe({
      next: (wallet) => {
        this.isManagingBalance.set(false);
        this.manageBalanceSuccess.set(`Successfully added $${amount.toLocaleString()} in virtual cash!`);
        this.loadDashboardData();
        setTimeout(() => {
          this.closeManageBalanceModal();
        }, 1500);
      },
      error: (err) => {
        this.isManagingBalance.set(false);
        this.manageBalanceError.set(err?.error?.message || 'Failed to deposit virtual funds.');
      }
    });
  }

  submitReset(): void {
    const target = Number(this.resetTargetAmount());
    if (!target || target <= 0) {
      this.manageBalanceError.set('Please enter a valid target balance greater than 0.');
      return;
    }

    this.isManagingBalance.set(true);
    this.manageBalanceError.set(null);
    this.manageBalanceSuccess.set(null);

    this.tradingService.resetCashBalance(target).subscribe({
      next: (wallet) => {
        this.isManagingBalance.set(false);
        this.manageBalanceSuccess.set(`Virtual cash balance successfully reset to $${target.toLocaleString()}!`);
        this.loadDashboardData();
        setTimeout(() => {
          this.closeManageBalanceModal();
        }, 1500);
      },
      error: (err) => {
        this.isManagingBalance.set(false);
        this.manageBalanceError.set(err?.error?.message || 'Failed to reset virtual cash balance.');
      }
    });
  }

  navigateToStock(symbol: string): void {
    if (!symbol) return;
    this.router.navigate(['/dashboard/stock', symbol]);
  }

  getCurrencySymbol(currency?: string): string {
    if (currency === 'INR') return '₹';
    if (currency === 'EUR') return '€';
    if (currency === 'GBP') return '£';
    return '$';
  }

  getStatusBadgeClass(status?: string): string {
    if (!status) return 'status-executed';
    const s = status.toUpperCase();
    if (s === 'EXECUTED' || s === 'SUCCESS' || s === 'FILLED') return 'status-executed';
    if (s === 'PENDING') return 'status-pending';
    return 'status-rejected';
  }
}
