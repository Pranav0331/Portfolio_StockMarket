import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { PortfolioSummary } from '../models/trading.model';

@Injectable({
  providedIn: 'root'
})
export class PortfolioService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  readonly portfolio = signal<PortfolioSummary | null>(null);
  readonly isLoading = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  getPortfolio(): Observable<PortfolioSummary> {
    this.isLoading.set(true);
    this.error.set(null);

    return this.http.get<PortfolioSummary>(`${this.baseUrl}/portfolio`).pipe(
      tap({
        next: (data) => {
          this.portfolio.set(data);
          this.isLoading.set(false);
          this.error.set(null);
        },
        error: (err) => {
          this.isLoading.set(false);
          const errorMsg = err?.error?.message || err?.message || 'Failed to load portfolio data. Please try again.';
          this.error.set(errorMsg);
        }
      })
    );
  }
}
