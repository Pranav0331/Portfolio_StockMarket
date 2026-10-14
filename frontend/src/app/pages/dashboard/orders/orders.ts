import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { OrderService } from '../../../services/order.service';
import {
  OrderItem,
  OrderPageResponse,
  OrderFilterParams,
  ConsolidatedTradeItem,
  ConsolidatedTradePageResponse,
  ConsolidatedTradeFilterParams,
  TradingMode
} from '../../../models/trading.model';

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './orders.html',
  styleUrls: ['./orders.css']
})
export class OrdersComponent implements OnInit {
  private readonly orderService = inject(OrderService);
  private readonly router = inject(Router);

  // View state signals
  readonly activeView = signal<'trades' | 'rawOrders'>('trades');
  readonly isLoading = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  // Consolidated Trades state signals
  readonly trades = signal<ConsolidatedTradeItem[]>([]);
  readonly tradesPageResponse = signal<ConsolidatedTradePageResponse | null>(null);
  readonly selectedTradeStatus = signal<'ALL' | 'OPEN' | 'CLOSED'>('ALL');
  readonly selectedTradeDirection = signal<'ALL' | 'LONG' | 'SHORT'>('ALL');

  // Raw Orders state signals
  readonly orders = signal<OrderItem[]>([]);
  readonly pageResponse = signal<OrderPageResponse | null>(null);
  readonly selectedType = signal<'ALL' | 'BUY' | 'SELL'>('ALL');
  readonly selectedStatus = signal<'ALL' | 'EXECUTED' | 'PENDING' | 'CANCELLED' | 'REJECTED'>('ALL');

  // Shared filter signals
  readonly selectedTradingMode = signal<'ALL' | TradingMode>('ALL');
  readonly symbolSearch = signal<string>('');
  readonly startDate = signal<string>('');
  readonly endDate = signal<string>('');
  readonly sortDirection = signal<'desc' | 'asc'>('desc');
  readonly currentPage = signal<number>(0);
  readonly pageSize = signal<number>(15);

  private searchDebounceTimer?: any;

  ngOnInit(): void {
    this.loadCurrentView();
  }

  loadCurrentView(): void {
    if (this.activeView() === 'trades') {
      this.loadTrades();
    } else {
      this.loadOrders();
    }
  }

  setActiveView(view: 'trades' | 'rawOrders'): void {
    if (this.activeView() === view) return;
    this.activeView.set(view);
    this.currentPage.set(0);
    this.error.set(null);
    this.loadCurrentView();
  }

  loadTrades(): void {
    this.isLoading.set(true);
    this.error.set(null);

    const filterParams: ConsolidatedTradeFilterParams = {
      status: this.selectedTradeStatus(),
      direction: this.selectedTradeDirection(),
      tradingMode: this.selectedTradingMode(),
      symbol: this.symbolSearch().trim() || undefined,
      startDate: this.startDate() || undefined,
      endDate: this.endDate() || undefined,
      page: this.currentPage(),
      size: this.pageSize(),
      sort: this.sortDirection()
    };

    this.orderService.getConsolidatedTrades(filterParams).subscribe({
      next: (res) => {
        this.tradesPageResponse.set(res);
        this.trades.set(res?.content || []);
        this.isLoading.set(false);
        this.error.set(null);
      },
      error: (err) => {
        this.isLoading.set(false);
        const errorMsg = err?.error?.message || err?.message || 'Failed to load consolidated trades.';
        this.error.set(errorMsg);
      }
    });
  }

  loadOrders(): void {
    this.isLoading.set(true);
    this.error.set(null);

    const filterParams: OrderFilterParams = {
      type: this.selectedType(),
      status: this.selectedStatus(),
      tradingMode: this.selectedTradingMode(),
      symbol: this.symbolSearch().trim() || undefined,
      startDate: this.startDate() || undefined,
      endDate: this.endDate() || undefined,
      page: this.currentPage(),
      size: this.pageSize(),
      sort: this.sortDirection()
    };

    this.orderService.getOrders(filterParams).subscribe({
      next: (res) => {
        this.pageResponse.set(res);
        this.orders.set(res?.content || []);
        this.isLoading.set(false);
        this.error.set(null);
      },
      error: (err) => {
        this.isLoading.set(false);
        const errorMsg = err?.error?.message || err?.message || 'Failed to load order book.';
        this.error.set(errorMsg);
      }
    });
  }

  refreshOrders(): void {
    this.loadCurrentView();
  }

  // Trades filters
  setTradeStatusFilter(status: 'ALL' | 'OPEN' | 'CLOSED'): void {
    if (this.selectedTradeStatus() === status) return;
    this.selectedTradeStatus.set(status);
    this.currentPage.set(0);
    this.loadTrades();
  }

  setTradeDirectionFilter(direction: 'ALL' | 'LONG' | 'SHORT'): void {
    if (this.selectedTradeDirection() === direction) return;
    this.selectedTradeDirection.set(direction);
    this.currentPage.set(0);
    this.loadTrades();
  }

  // Raw orders filters
  setTypeFilter(type: 'ALL' | 'BUY' | 'SELL'): void {
    if (this.selectedType() === type) return;
    this.selectedType.set(type);
    this.currentPage.set(0);
    this.loadOrders();
  }

  setStatusFilter(status: 'ALL' | 'EXECUTED' | 'PENDING' | 'CANCELLED' | 'REJECTED'): void {
    if (this.selectedStatus() === status) return;
    this.selectedStatus.set(status);
    this.currentPage.set(0);
    this.loadOrders();
  }

  setTradingModeFilter(mode: 'ALL' | TradingMode): void {
    if (this.selectedTradingMode() === mode) return;
    this.selectedTradingMode.set(mode);
    this.currentPage.set(0);
    this.loadCurrentView();
  }

  onSymbolInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input?.value || '';
    this.symbolSearch.set(value);

    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }
    this.searchDebounceTimer = setTimeout(() => {
      this.currentPage.set(0);
      this.loadCurrentView();
    }, 300);
  }

  clearSymbolSearch(): void {
    this.symbolSearch.set('');
    this.currentPage.set(0);
    this.loadCurrentView();
  }

  onStartDateChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.startDate.set(input?.value || '');
    this.currentPage.set(0);
    this.loadCurrentView();
  }

  onEndDateChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.endDate.set(input?.value || '');
    this.currentPage.set(0);
    this.loadCurrentView();
  }

  onSortChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.sortDirection.set((select?.value as 'desc' | 'asc') || 'desc');
    this.currentPage.set(0);
    this.loadCurrentView();
  }

  resetFilters(): void {
    this.selectedTradeStatus.set('ALL');
    this.selectedTradeDirection.set('ALL');
    this.selectedType.set('ALL');
    this.selectedStatus.set('ALL');
    this.selectedTradingMode.set('ALL');
    this.symbolSearch.set('');
    this.startDate.set('');
    this.endDate.set('');
    this.sortDirection.set('desc');
    this.currentPage.set(0);
    this.loadCurrentView();
  }

  hasActiveFilters(): boolean {
    if (this.activeView() === 'trades') {
      return this.selectedTradeStatus() !== 'ALL' ||
        this.selectedTradeDirection() !== 'ALL' ||
        this.selectedTradingMode() !== 'ALL' ||
        this.symbolSearch().trim().length > 0 ||
        this.startDate().length > 0 ||
        this.endDate().length > 0;
    }
    return this.selectedType() !== 'ALL' ||
      this.selectedStatus() !== 'ALL' ||
      this.selectedTradingMode() !== 'ALL' ||
      this.symbolSearch().trim().length > 0 ||
      this.startDate().length > 0 ||
      this.endDate().length > 0;
  }

  goToPage(page: number): void {
    if (page < 0) return;
    const current = this.activeView() === 'trades' ? this.tradesPageResponse() : this.pageResponse();
    if (current && page >= current.totalPages) return;

    this.currentPage.set(page);
    this.loadCurrentView();
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
    if (s === 'EXECUTED' || s === 'FILLED' || s === 'SUCCESS' || s === 'CLOSED') return 'status-executed';
    if (s === 'PENDING' || s === 'OPEN') return 'status-pending';
    if (s === 'CANCELLED') return 'status-cancelled';
    return 'status-rejected';
  }

  getTradingModeLabel(mode?: string): string {
    if (!mode) return 'Intraday';
    const m = mode.toUpperCase();
    if (m === 'SCALPING') return 'Scalping';
    if (m === 'SWING') return 'Swing';
    if (m === 'LONG_TERM' || m === 'LONG TERM') return 'Long Term';
    return 'Intraday';
  }

  getTradingModeBadgeClass(mode?: string): string {
    if (!mode) return 'mode-intraday';
    const m = mode.toUpperCase();
    if (m === 'SCALPING') return 'mode-scalping';
    if (m === 'SWING') return 'mode-swing';
    if (m === 'LONG_TERM' || m === 'LONG TERM') return 'mode-long-term';
    return 'mode-intraday';
  }

  getPageNumbers(totalPages: number): number[] {
    const maxButtons = 5;
    const current = this.currentPage();
    let start = Math.max(0, current - Math.floor(maxButtons / 2));
    let end = Math.min(totalPages, start + maxButtons);

    if (end - start < maxButtons) {
      start = Math.max(0, end - maxButtons);
    }

    const pages: number[] = [];
    for (let i = start; i < end; i++) {
      pages.push(i);
    }
    return pages;
  }

  getDisplayEnd(page: number, size: number, total: number): number {
    return Math.min((page + 1) * size, total);
  }
}
