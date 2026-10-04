import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { OrderService } from '../../../services/order.service';
import { OrderItem, OrderPageResponse, OrderFilterParams } from '../../../models/trading.model';

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
  readonly orders = signal<OrderItem[]>([]);
  readonly pageResponse = signal<OrderPageResponse | null>(null);
  readonly isLoading = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  // Filter signals
  readonly selectedType = signal<'ALL' | 'BUY' | 'SELL'>('ALL');
  readonly selectedStatus = signal<'ALL' | 'EXECUTED' | 'PENDING' | 'CANCELLED' | 'REJECTED'>('ALL');
  readonly symbolSearch = signal<string>('');
  readonly startDate = signal<string>('');
  readonly endDate = signal<string>('');
  readonly sortDirection = signal<'desc' | 'asc'>('desc');
  readonly currentPage = signal<number>(0);
  readonly pageSize = signal<number>(15);

  private searchDebounceTimer?: any;

  ngOnInit(): void {
    this.loadOrders();
  }

  loadOrders(): void {
    this.isLoading.set(true);
    this.error.set(null);

    const filterParams: OrderFilterParams = {
      type: this.selectedType(),
      status: this.selectedStatus(),
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
        this.orders.set(res.content || []);
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
    this.loadOrders();
  }

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

  onSymbolInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input?.value || '';
    this.symbolSearch.set(value);

    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }
    this.searchDebounceTimer = setTimeout(() => {
      this.currentPage.set(0);
      this.loadOrders();
    }, 300);
  }

  clearSymbolSearch(): void {
    this.symbolSearch.set('');
    this.currentPage.set(0);
    this.loadOrders();
  }

  onStartDateChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.startDate.set(input?.value || '');
    this.currentPage.set(0);
    this.loadOrders();
  }

  onEndDateChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.endDate.set(input?.value || '');
    this.currentPage.set(0);
    this.loadOrders();
  }

  onSortChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.sortDirection.set((select?.value as 'desc' | 'asc') || 'desc');
    this.currentPage.set(0);
    this.loadOrders();
  }

  resetFilters(): void {
    this.selectedType.set('ALL');
    this.selectedStatus.set('ALL');
    this.symbolSearch.set('');
    this.startDate.set('');
    this.endDate.set('');
    this.sortDirection.set('desc');
    this.currentPage.set(0);
    this.loadOrders();
  }

  hasActiveFilters(): boolean {
    return this.selectedType() !== 'ALL' ||
      this.selectedStatus() !== 'ALL' ||
      this.symbolSearch().trim().length > 0 ||
      this.startDate().length > 0 ||
      this.endDate().length > 0;
  }

  goToPage(page: number): void {
    if (page < 0) return;
    const current = this.pageResponse();
    if (current && page >= current.totalPages) return;

    this.currentPage.set(page);
    this.loadOrders();
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
    if (s === 'EXECUTED' || s === 'FILLED' || s === 'SUCCESS') return 'status-executed';
    if (s === 'PENDING') return 'status-pending';
    if (s === 'CANCELLED') return 'status-cancelled';
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
