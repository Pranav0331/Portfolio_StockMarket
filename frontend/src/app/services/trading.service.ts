import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { TradeRequest, TradeResponse, VirtualWallet, UserHolding, PortfolioSummary } from '../models/trading.model';

@Injectable({
  providedIn: 'root'
})
export class TradingService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  readonly wallet = signal<VirtualWallet | null>(null);
  readonly currentHolding = signal<UserHolding | null>(null);
  readonly holdings = signal<UserHolding[]>([]);
  readonly holdingsMap = signal<Map<string, UserHolding>>(new Map());
  readonly portfolio = signal<PortfolioSummary | null>(null);

  buy(request: TradeRequest): Observable<TradeResponse> {
    return this.http.post<TradeResponse>(`${this.baseUrl}/trading/buy`, request).pipe(
      tap((res) => {
        // Refresh wallet balance signal with remaining balance
        if (this.wallet()) {
          this.wallet.update(w => w ? { ...w, cashBalance: res.remainingCashBalance } : null);
        }
        // Immediately sync holdings, active holding, and portfolio everywhere
        this.getHoldings().subscribe({ error: () => {} });
        this.getPortfolio().subscribe({ error: () => {} });
        if (request.symbol) {
          this.getHoldingForSymbol(request.symbol).subscribe({ error: () => {} });
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
        // Immediately sync holdings, active holding, and portfolio everywhere
        this.getHoldings().subscribe({ error: () => {} });
        this.getPortfolio().subscribe({ error: () => {} });
        if (request.symbol) {
          this.getHoldingForSymbol(request.symbol).subscribe({ error: () => {} });
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
    return this.http.get<UserHolding[]>(`${this.baseUrl}/trading/holdings`).pipe(
      tap(holdings => {
        this.holdings.set(holdings || []);
        const map = new Map<string, UserHolding>();
        for (const h of (holdings || [])) {
          if (h.symbol) {
            map.set(h.symbol.trim().toUpperCase(), h);
          }
        }
        this.holdingsMap.set(map);
      })
    );
  }

  getHoldingForSymbol(symbol: string): Observable<UserHolding> {
    const sym = symbol.trim().toUpperCase();
    return this.http.get<UserHolding>(`${this.baseUrl}/trading/holdings/${encodeURIComponent(sym)}`).pipe(
      tap(holding => {
        this.currentHolding.set(holding);
        if (holding) {
          this.holdingsMap.update(map => {
            const next = new Map(map);
            next.set(sym, holding);
            return next;
          });
        } else {
          this.holdingsMap.update(map => {
            const next = new Map(map);
            next.delete(sym);
            return next;
          });
        }
      })
    );
  }

  getPortfolio(): Observable<PortfolioSummary> {
    return this.http.get<PortfolioSummary>(`${this.baseUrl}/portfolio`).pipe(
      tap(summary => {
        this.portfolio.set(summary);
        if (summary && summary.holdings) {
          this.holdings.set(summary.holdings);
          const map = new Map<string, UserHolding>();
          for (const h of summary.holdings) {
            if (h.symbol) {
              map.set(h.symbol.trim().toUpperCase(), h);
            }
          }
          this.holdingsMap.set(map);
        }
      })
    );
  }
}

