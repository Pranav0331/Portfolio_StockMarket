import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { TransactionService } from '../../../services/transaction.service';
import { TransactionItem, TransactionPageResponse, TransactionFilterParams, TradingMode } from '../../../models/trading.model';

@Component({
  selector: 'app-transactions',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './transactions.html',
  styleUrls: ['./transactions.css']
})
export class TransactionsComponent implements OnInit {
  private readonly transactionService = inject(TransactionService);
  private readonly router = inject(Router);

  // View state signals
  readonly transactions = signal<TransactionItem[]>([]);
  readonly pageResponse = signal<TransactionPageResponse | null>(null);
  readonly isLoading = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  // Filter signals
  readonly selectedType = signal<'ALL' | 'BUY' | 'SELL'>('ALL');
  readonly selectedTradingMode = signal<'ALL' | TradingMode>('ALL');
  readonly symbolSearch = signal<string>('');
  readonly startDate = signal<string>('');
  readonly endDate = signal<string>('');
  readonly sortDirection = signal<'desc' | 'asc'>('desc');
  readonly currentPage = signal<number>(0);
  readonly pageSize = signal<number>(15);

  private searchDebounceTimer?: any;

  ngOnInit(): void {
    this.loadTransactions();
  }

  loadTransactions(): void {
    this.isLoading.set(true);
    this.error.set(null);

    const filterParams: TransactionFilterParams = {
      type: this.selectedType(),
      tradingMode: this.selectedTradingMode(),
      symbol: this.symbolSearch().trim() || undefined,
      startDate: this.startDate() || undefined,
      endDate: this.endDate() || undefined,
      page: this.currentPage(),
      size: this.pageSize(),
      sort: this.sortDirection()
    };

    this.transactionService.getTransactions(filterParams).subscribe({
      next: (res) => {
        this.pageResponse.set(res);
        this.transactions.set(res.content || []);
        this.isLoading.set(false);
        this.error.set(null);
      },
      error: (err) => {
        this.isLoading.set(false);
        const errorMsg = err?.error?.message || err?.message || 'Failed to load transaction history.';
        this.error.set(errorMsg);
      }
    });
  }

  refreshTransactions(): void {
    this.loadTransactions();
  }

  setTypeFilter(type: 'ALL' | 'BUY' | 'SELL'): void {
    if (this.selectedType() === type) return;
    this.selectedType.set(type);
    this.currentPage.set(0);
    this.loadTransactions();
  }

  setTradingModeFilter(mode: 'ALL' | TradingMode): void {
    if (this.selectedTradingMode() === mode) return;
    this.selectedTradingMode.set(mode);
    this.currentPage.set(0);
    this.loadTransactions();
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
      this.loadTransactions();
    }, 300);
  }

  clearSymbolSearch(): void {
    this.symbolSearch.set('');
    this.currentPage.set(0);
    this.loadTransactions();
  }

  onStartDateChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.startDate.set(input?.value || '');
    this.currentPage.set(0);
    this.loadTransactions();
  }

  onEndDateChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.endDate.set(input?.value || '');
    this.currentPage.set(0);
    this.loadTransactions();
  }

  onSortChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.sortDirection.set((select?.value as 'desc' | 'asc') || 'desc');
    this.currentPage.set(0);
    this.loadTransactions();
  }

  resetFilters(): void {
    this.selectedType.set('ALL');
    this.selectedTradingMode.set('ALL');
    this.symbolSearch.set('');
    this.startDate.set('');
    this.endDate.set('');
    this.sortDirection.set('desc');
    this.currentPage.set(0);
    this.loadTransactions();
  }

  hasActiveFilters(): boolean {
    return this.selectedType() !== 'ALL' ||
      this.selectedTradingMode() !== 'ALL' ||
      this.symbolSearch().trim().length > 0 ||
      this.startDate().length > 0 ||
      this.endDate().length > 0;
  }

  goToPage(page: number): void {
    if (page < 0) return;
    const current = this.pageResponse();
    if (current && page >= current.totalPages) return;

    this.currentPage.set(page);
    this.loadTransactions();
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
    if (s === 'EXECUTED' || s === 'SUCCESS') return 'status-executed';
    if (s === 'PENDING') return 'status-pending';
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
