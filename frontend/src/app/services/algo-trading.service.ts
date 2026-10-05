import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  AlgoStrategy,
  AlgoEvaluationResult,
  AlgoPerformanceSummary,
  AlgoTradeLog
} from '../models/algo-trading.model';

@Injectable({
  providedIn: 'root'
})
export class AlgoTradingService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/algo`;

  readonly strategies = signal<AlgoStrategy[]>([]);
  readonly activeStrategy = signal<AlgoStrategy | null>(null);
  readonly evaluationResult = signal<AlgoEvaluationResult | null>(null);
  readonly tradeLogs = signal<AlgoTradeLog[]>([]);
  readonly performanceSummary = signal<AlgoPerformanceSummary | null>(null);
  readonly isLoading = signal<boolean>(false);

  // Strategy CRUD
  getStrategies(): Observable<AlgoStrategy[]> {
    return this.http.get<AlgoStrategy[]>(`${this.baseUrl}/strategies`).pipe(
      tap((data) => this.strategies.set(data || []))
    );
  }

  getStrategyById(id: number): Observable<AlgoStrategy> {
    return this.http.get<AlgoStrategy>(`${this.baseUrl}/strategies/${id}`).pipe(
      tap((data) => this.activeStrategy.set(data))
    );
  }

  createStrategy(strategy: Partial<AlgoStrategy>): Observable<AlgoStrategy> {
    return this.http.post<AlgoStrategy>(`${this.baseUrl}/strategies`, strategy).pipe(
      tap((saved) => {
        this.strategies.update((list) => [saved, ...list]);
        this.activeStrategy.set(saved);
      })
    );
  }

  updateStrategy(id: number, strategy: Partial<AlgoStrategy>): Observable<AlgoStrategy> {
    return this.http.put<AlgoStrategy>(`${this.baseUrl}/strategies/${id}`, strategy).pipe(
      tap((updated) => {
        this.strategies.update((list) =>
          list.map((s) => (s.id === id ? updated : s))
        );
        if (this.activeStrategy()?.id === id) {
          this.activeStrategy.set(updated);
        }
      })
    );
  }

  deleteStrategy(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/strategies/${id}`).pipe(
      tap(() => {
        this.strategies.update((list) => list.filter((s) => s.id !== id));
        if (this.activeStrategy()?.id === id) {
          this.activeStrategy.set(null);
        }
      })
    );
  }

  // Execution controls
  startStrategy(id: number): Observable<AlgoEvaluationResult> {
    return this.http.post<AlgoEvaluationResult>(`${this.baseUrl}/strategies/${id}/start`, {}).pipe(
      tap((evalResult) => {
        this.evaluationResult.set(evalResult);
        this.getStrategies().subscribe();
        this.getStrategyTradeLogs(id).subscribe();
        this.getStrategyPerformance(id).subscribe();
      })
    );
  }

  pauseStrategy(id: number): Observable<AlgoStrategy> {
    return this.http.post<AlgoStrategy>(`${this.baseUrl}/strategies/${id}/pause`, {}).pipe(
      tap((updated) => {
        this.strategies.update((list) =>
          list.map((s) => (s.id === id ? updated : s))
        );
        if (this.activeStrategy()?.id === id) {
          this.activeStrategy.set(updated);
        }
      })
    );
  }

  stopStrategy(id: number): Observable<AlgoStrategy> {
    return this.http.post<AlgoStrategy>(`${this.baseUrl}/strategies/${id}/stop`, {}).pipe(
      tap((updated) => {
        this.strategies.update((list) =>
          list.map((s) => (s.id === id ? updated : s))
        );
        if (this.activeStrategy()?.id === id) {
          this.activeStrategy.set(updated);
        }
      })
    );
  }

  // Real-time AI Evaluation
  evaluateStrategy(id: number): Observable<AlgoEvaluationResult> {
    return this.http.get<AlgoEvaluationResult>(`${this.baseUrl}/strategies/${id}/evaluate`).pipe(
      tap((res) => this.evaluationResult.set(res))
    );
  }

  evaluateMarket(symbol: string, timeframe: string = '15m'): Observable<AlgoEvaluationResult> {
    const params = new HttpParams()
      .set('symbol', symbol)
      .set('timeframe', timeframe);
    return this.http.get<AlgoEvaluationResult>(`${this.baseUrl}/evaluate`, { params }).pipe(
      tap((res) => this.evaluationResult.set(res))
    );
  }

  // Performance & Logs
  getStrategyPerformance(id: number): Observable<AlgoPerformanceSummary> {
    return this.http.get<AlgoPerformanceSummary>(`${this.baseUrl}/strategies/${id}/performance`).pipe(
      tap((res) => this.performanceSummary.set(res))
    );
  }

  getStrategyTradeLogs(id: number): Observable<AlgoTradeLog[]> {
    return this.http.get<AlgoTradeLog[]>(`${this.baseUrl}/strategies/${id}/trades`).pipe(
      tap((res) => this.tradeLogs.set(res || []))
    );
  }

  getAllTradeLogs(): Observable<AlgoTradeLog[]> {
    return this.http.get<AlgoTradeLog[]>(`${this.baseUrl}/trades`).pipe(
      tap((res) => this.tradeLogs.set(res || []))
    );
  }
}
