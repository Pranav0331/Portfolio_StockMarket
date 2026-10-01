import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { TransactionFilterParams, TransactionPageResponse, TransactionItem } from '../models/trading.model';

@Injectable({
  providedIn: 'root'
})
export class TransactionService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  readonly transactions = signal<TransactionItem[]>([]);
  readonly pageResponse = signal<TransactionPageResponse | null>(null);
  readonly isLoading = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  getTransactions(filterParams?: TransactionFilterParams): Observable<TransactionPageResponse> {
    this.isLoading.set(true);
    this.error.set(null);

    let params = new HttpParams();
    if (filterParams) {
      if (filterParams.type && filterParams.type !== 'ALL') {
        params = params.set('type', filterParams.type);
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

    return this.http.get<TransactionPageResponse>(`${this.baseUrl}/transactions`, { params }).pipe(
      tap({
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
      })
    );
  }
}
