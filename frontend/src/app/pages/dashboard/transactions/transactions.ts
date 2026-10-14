import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { TransactionService } from '../../../services/transaction.service';
import { TransactionItem, TransactionPageResponse, TransactionFilterParams, AccountSummary } from '../../../models/trading.model';

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
  readonly accountSummary = signal<AccountSummary | null>(null);
  readonly isLoading = signal<boolean>(false);
  readonly isSummaryLoading = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  // Filter signals - Financial ledger events only
  readonly selectedType = signal<'ALL' | 'ACCOUNT_INIT' | 'DEPOSIT' | 'ACCOUNT_RESET' | 'DIVIDEND' | 'BUY' | 'SELL' | string>('ALL');
  readonly symbolSearch = signal<string>('');
  readonly startDate = signal<string>('');
  readonly endDate = signal<string>('');
  readonly sortDirection = signal<'desc' | 'asc'>('desc');
  readonly currentPage = signal<number>(0);
  readonly pageSize = signal<number>(15);

  private searchDebounceTimer?: any;

  ngOnInit(): void {
    this.loadAccountSummary();
    this.loadTransactions();
  }

  loadAccountSummary(): void {
    this.isSummaryLoading.set(true);
    this.transactionService.getAccountSummary().subscribe({
      next: (summary) => {
        this.accountSummary.set(summary);
        this.isSummaryLoading.set(false);
      },
      error: (err) => {
        this.isSummaryLoading.set(false);
        console.error('Could not load paper trading account summary:', err);
      }
    });
  }

  loadTransactions(): void {
    this.isLoading.set(true);
    this.error.set(null);

    // Financial ledger only: excludes trade executions (BUY/SELL) which belong on Orders & closed trades
    const filterParams: TransactionFilterParams = {
      financialOnly: true,
      type: this.selectedType(),
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
        const errorMsg = err?.error?.message || err?.message || 'Failed to load paper trading account ledger.';
        this.error.set(errorMsg);
      }
    });
  }

  refreshTransactions(): void {
    this.loadAccountSummary();
    this.loadTransactions();
  }

  setTypeFilter(type: any): void {
    if (this.selectedType() === type) return;
    this.selectedType.set(type);
    this.currentPage.set(0);
    this.loadTransactions();
  }

  onSearchInput(event: Event): void {
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

  onSymbolInput(event: Event): void {
    this.onSearchInput(event);
  }

  clearSearch(): void {
    this.symbolSearch.set('');
    this.currentPage.set(0);
    this.loadTransactions();
  }

  clearSymbolSearch(): void {
    this.clearSearch();
  }

  navigateToStock(symbol: string): void {
    if (!symbol || !this.isTradeableStock(symbol)) return;
    this.router.navigate(['/dashboard/stock', symbol]);
  }

  isTradeableStock(symbol?: string): boolean {
    if (!symbol) return false;
    const s = symbol.trim().toUpperCase();
    return s !== 'UNKNOWN' && s !== 'CASH' && s !== 'DEPOSIT' && s !== 'WITHDRAWAL' && s !== 'DIVIDEND' && s !== 'INIT' && s !== 'RESET';
  }

  isAmountOutflow(type?: string): boolean {
    if (!type) return false;
    const t = type.trim().toUpperCase();
    return t === 'BUY' || t === 'WITHDRAWAL';
  }

  getTransactionBadgeClass(type?: string): string {
    const t = (type || '').trim().toUpperCase();
    if (t === 'BUY') return 'badge-buy';
    if (t === 'SELL') return 'badge-sell';
    return this.getEventTypeBadgeClass(type);
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
    this.symbolSearch.set('');
    this.startDate.set('');
    this.endDate.set('');
    this.sortDirection.set('desc');
    this.currentPage.set(0);
    this.loadTransactions();
  }

  hasActiveFilters(): boolean {
    return this.selectedType() !== 'ALL' ||
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

  // Cash Flow & Ledger Helpers
  getEventTypeLabel(type?: string): string {
    if (!type) return 'Financial Event';
    const t = type.trim().toUpperCase();
    switch (t) {
      case 'ACCOUNT_INIT': return 'Initial Credit';
      case 'DEPOSIT': return 'Deposit / Top-up';
      case 'WITHDRAWAL': return 'Cash Withdrawal';
      case 'ACCOUNT_RESET': return 'Reset Event';
      case 'DIVIDEND': return 'Cash Adjustment';
      default: return t.replace('_', ' ');
    }
  }

  getEventTypeBadgeClass(type?: string): string {
    if (!type) return 'badge-neutral';
    const t = type.trim().toUpperCase();
    switch (t) {
      case 'ACCOUNT_INIT': return 'badge-init';
      case 'DEPOSIT': return 'badge-deposit';
      case 'WITHDRAWAL': return 'badge-withdrawal';
      case 'ACCOUNT_RESET': return 'badge-reset';
      case 'DIVIDEND': return 'badge-adjustment';
      default: return 'badge-neutral';
    }
  }

  getCashFlowImpactClass(tx: TransactionItem): string {
    const impact = (tx.cashFlowImpact || '').toUpperCase();
    if (impact === 'CREDIT' || tx.type === 'DEPOSIT' || tx.type === 'ACCOUNT_INIT' || tx.type === 'DIVIDEND') {
      return 'impact-credit';
    }
    if (impact === 'DEBIT' || tx.type === 'WITHDRAWAL') {
      return 'impact-debit';
    }
    if (impact === 'RESET' || tx.type === 'ACCOUNT_RESET') {
      return 'impact-reset';
    }
    return 'impact-neutral';
  }

  getCashFlowSign(tx: TransactionItem): string {
    const impact = (tx.cashFlowImpact || '').toUpperCase();
    if (impact === 'CREDIT' || tx.type === 'DEPOSIT' || tx.type === 'ACCOUNT_INIT' || tx.type === 'DIVIDEND') {
      return '+';
    }
    if (impact === 'DEBIT' || tx.type === 'WITHDRAWAL') {
      return '-';
    }
    if (impact === 'RESET' || tx.type === 'ACCOUNT_RESET') {
      return '=';
    }
    return '';
  }

  getCashFlowImpactExplanation(tx: TransactionItem): string {
    if (tx.cashFlowImpactLabel) {
      return tx.cashFlowImpactLabel;
    }
    const t = (tx.type || '').toUpperCase();
    switch (t) {
      case 'ACCOUNT_INIT': return '+ Increases Cash (Initial Credit)';
      case 'DEPOSIT': return '+ Increases Cash (Deposit)';
      case 'WITHDRAWAL': return '- Decreases Cash (Withdrawal)';
      case 'ACCOUNT_RESET': return '= Replaces Cash Balance (Reset)';
      case 'DIVIDEND': return '+ Increases Cash (Adjustment)';
      default: return 'Account Cash Event';
    }
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
    if (s === 'EXECUTED' || s === 'SUCCESS' || s === 'COMPLETED') return 'status-executed';
    if (s === 'PENDING') return 'status-pending';
    return 'status-rejected';
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
