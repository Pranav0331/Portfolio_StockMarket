import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { TradeRequest, TradeResponse, VirtualWallet, UserHolding } from '../models/trading.model';

@Injectable({
  providedIn: 'root'
})
export class TradingService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  readonly wallet = signal<VirtualWallet | null>(null);
  readonly currentHolding = signal<UserHolding | null>(null);

  buy(request: TradeRequest): Observable<TradeResponse> {
    return this.http.post<TradeResponse>(`${this.baseUrl}/trading/buy`, request).pipe(
      tap((res) => {
        // Refresh wallet balance signal with remaining balance
        if (this.wallet()) {
          this.wallet.update(w => w ? { ...w, cashBalance: res.remainingCashBalance } : null);
        }
      })
    );
  }

  sell(request: TradeRequest): Observable<TradeResponse> {
    return this.http.post<TradeResponse>(`${this.baseUrl}/trading/sell`, request).pipe(
      tap((res) => {
        if (this.wallet()) {
          this.wallet.update(w => w ? { ...w, cashBalance: res.remainingCashBalance } : null);
        }
      })
    );
  }

  getWallet(): Observable<VirtualWallet> {
    return this.http.get<VirtualWallet>(`${this.baseUrl}/trading/wallet`).pipe(
      tap(wallet => this.wallet.set(wallet))
    );
  }

  getHoldings(): Observable<UserHolding[]> {
    return this.http.get<UserHolding[]>(`${this.baseUrl}/trading/holdings`);
  }

  getHoldingForSymbol(symbol: string): Observable<UserHolding> {
    return this.http.get<UserHolding>(`${this.baseUrl}/trading/holdings/${encodeURIComponent(symbol)}`).pipe(
      tap(holding => this.currentHolding.set(holding))
    );
  }
}
