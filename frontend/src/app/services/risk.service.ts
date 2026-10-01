import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { PortfolioRisk } from '../models/risk.model';

@Injectable({
  providedIn: 'root'
})
export class RiskService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  readonly riskData = signal<PortfolioRisk | null>(null);
  readonly isLoading = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  getPortfolioRisk(): Observable<PortfolioRisk> {
    this.isLoading.set(true);
    this.error.set(null);

    return this.http.get<PortfolioRisk>(`${this.baseUrl}/portfolio/risk`).pipe(
      tap({
        next: (data) => {
          this.riskData.set(data);
          this.isLoading.set(false);
          this.error.set(null);
        },
        error: (err) => {
          this.isLoading.set(false);
          const errorMsg = err?.error?.message || err?.message || 'Failed to load portfolio risk analysis. Please try again.';
          this.error.set(errorMsg);
        }
      })
    );
  }
}
