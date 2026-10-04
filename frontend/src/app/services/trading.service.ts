import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  TradeRequest,
  TradeResponse,
  VirtualWallet,
  UserHolding,
  PortfolioSummary,
  PositionItem,
  PositionStatus
} from '../models/trading.model';

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
  readonly openPositions = signal<PositionItem[]>([]);

  buy(request: TradeRequest): Observable<TradeResponse> {
    return this.http.post<TradeResponse>(`${this.baseUrl}/trading/buy`, request).pipe(
      tap((res) => {
        if (this.wallet()) {
          this.wallet.update(w => w ? { ...w, cashBalance: res.remainingCashBalance } : null);
        }
        this.getHoldings().subscribe({ error: () => {} });
        this.getPortfolio().subscribe({ error: () => {} });
        this.getPositions(request.symbol, 'OPEN').subscribe({ error: () => {} });
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
        this.getHoldings().subscribe({ error: () => {} });
        this.getPortfolio().subscribe({ error: () => {} });
        this.getPositions(request.symbol, 'OPEN').subscribe({ error: () => {} });
        if (request.symbol) {
          this.getHoldingForSymbol(request.symbol).subscribe({ error: () => {} });
        }
      })
    );
  }

  getPositions(symbol?: string, status?: PositionStatus): Observable<PositionItem[]> {
    let params = new HttpParams();
    if (symbol) params = params.set('symbol', symbol.trim().toUpperCase());
    if (status) params = params.set('status', status);

    return this.http.get<PositionItem[]>(`${this.baseUrl}/trading/positions`, { params }).pipe(
      tap(positions => {
        if (!status || status === 'OPEN') {
          this.openPositions.set(positions || []);
        }
      })
    );
  }

  closePosition(positionId: number, quantity?: number): Observable<PositionItem> {
    const body = quantity ? { quantity } : {};
    return this.http.post<PositionItem>(`${this.baseUrl}/trading/positions/${positionId}/close`, body).pipe(
      tap(() => {
        this.getWallet().subscribe({ error: () => {} });
        this.getHoldings().subscribe({ error: () => {} });
        this.getPortfolio().subscribe({ error: () => {} });
        this.getPositions(undefined, 'OPEN').subscribe({ error: () => {} });
      })
    );
  }

  updateSlTp(positionId: number, stopLoss?: number, takeProfit?: number): Observable<PositionItem> {
    return this.http.put<PositionItem>(`${this.baseUrl}/trading/positions/${positionId}/sl-tp`, {
      stopLoss: stopLoss ?? null,
      takeProfit: takeProfit ?? null
    }).pipe(
      tap(updatedPos => {
        this.openPositions.update(positions =>
          positions.map(p => p.id === positionId ? updatedPos : p)
        );
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

  depositCash(amount: number): Observable<VirtualWallet> {
    return this.http.post<VirtualWallet>(`${this.baseUrl}/trading/wallet/deposit`, { amount }).pipe(
      tap(wallet => {
        this.wallet.set(wallet);
        this.getPortfolio().subscribe({ error: () => {} });
      })
    );
  }

  resetCashBalance(targetBalance?: number): Observable<VirtualWallet> {
    const body = targetBalance !== undefined && targetBalance !== null ? { targetBalance } : {};
    return this.http.post<VirtualWallet>(`${this.baseUrl}/trading/wallet/reset`, body).pipe(
      tap(wallet => {
        this.wallet.set(wallet);
        this.getPortfolio().subscribe({ error: () => {} });
      })
    );
  }
}
