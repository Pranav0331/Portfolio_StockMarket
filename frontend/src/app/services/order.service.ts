import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { OrderFilterParams, OrderPageResponse, OrderItem } from '../models/trading.model';

@Injectable({
  providedIn: 'root'
})
export class OrderService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  readonly orders = signal<OrderItem[]>([]);
  readonly pageResponse = signal<OrderPageResponse | null>(null);
  readonly isLoading = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  getOrders(filterParams?: OrderFilterParams): Observable<OrderPageResponse> {
    this.isLoading.set(true);
    this.error.set(null);

    let params = new HttpParams();
    if (filterParams) {
      if (filterParams.type && filterParams.type !== 'ALL') {
        params = params.set('type', filterParams.type);
      }
      if (filterParams.status && filterParams.status !== 'ALL') {
        params = params.set('status', filterParams.status);
      }
      if (filterParams.tradingMode && filterParams.tradingMode !== 'ALL') {
        params = params.set('tradingMode', filterParams.tradingMode);
      }
      if (filterParams.symbol && filterParams.symbol.trim()) {
        params = params.set('symbol', filterParams.symbol.trim());
      }
      if (filterParams.startDate) {
        params = params.set('startDate', filterParams.startDate);
      }
      if (filterParams.endDate) {
        params = params.set('endDate', filterParams.endDate);
      }
      if (filterParams.page !== undefined && filterParams.page !== null) {
        params = params.set('page', filterParams.page.toString());
      }
      if (filterParams.size !== undefined && filterParams.size !== null) {
        params = params.set('size', filterParams.size.toString());
      }
      if (filterParams.sort) {
        params = params.set('sort', filterParams.sort);
      }
    }

    return this.http.get<OrderPageResponse>(`${this.baseUrl}/orders`, { params }).pipe(
      tap({
        next: (res) => {
          this.pageResponse.set(res);
          this.orders.set(res.content || []);
          this.isLoading.set(false);
          this.error.set(null);
        },
        error: (err) => {
          this.isLoading.set(false);
          const errorMsg = err?.error?.message || err?.message || 'Failed to load order history.';
          this.error.set(errorMsg);
        }
      })
    );
  }
}
