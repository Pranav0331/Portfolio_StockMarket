import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  AlgoStrategy,
  AlgoEvaluationResult,
  AlgoPerformanceSummary,
  AlgoTradeLog
} from '../models/algo-trading.model';

function mapBackendToStrategy(raw: any): AlgoStrategy {
  if (!raw) return raw;
  return {
    id: raw.id,
    userId: raw.userId,
    name: raw.name || '',
    symbol: raw.symbol || '',
    marketType: raw.market || raw.marketType || 'CRYPTO',
    tradingMode: raw.tradingMode || 'INTRADAY',
    timeframe: raw.timeframe || '15m',
    direction: raw.direction || 'BOTH',
    useEma9: raw.useEmaCross ?? raw.useEma9 ?? true,
    ema9Period: raw.emaFastPeriod ?? raw.ema9Period ?? 9,
    useEma21: raw.useEmaCross ?? raw.useEma21 ?? true,
    ema21Period: raw.emaSlowPeriod ?? raw.ema21Period ?? 21,
    useRsi: raw.useRsiFilter ?? raw.useRsi ?? true,
    rsiPeriod: raw.rsiPeriod ?? 14,
    rsiLongThreshold: raw.rsiOverbought ?? raw.rsiLongThreshold ?? 55,
    rsiShortThreshold: raw.rsiOversold ?? raw.rsiShortThreshold ?? 45,
    useMacd: raw.useMacdFilter ?? raw.useMacd ?? true,
    macdFast: raw.macdFast ?? 12,
    macdSlow: raw.macdSlow ?? 26,
    macdSignal: raw.macdSignal ?? 9,
    useBollinger: raw.useBbFilter ?? raw.useBollinger ?? false,
    bollingerPeriod: raw.bbPeriod ?? raw.bollingerPeriod ?? 20,
    bollingerStdDev: raw.bbStdDev ?? raw.bollingerStdDev ?? 2.0,
    condEmaCross: raw.useEmaCross ?? raw.condEmaCross ?? true,
    condRsiThreshold: raw.useRsiFilter ?? raw.condRsiThreshold ?? true,
    condMacdDirection: raw.useMacdFilter ?? raw.condMacdDirection ?? true,
    condBollingerBounce: raw.useBbFilter ?? raw.condBollingerBounce ?? false,
    isPaperTrading: true,
    virtualCapital: 100000,
    riskPerTradePercent: raw.riskPerTradePct ?? raw.riskPerTradePercent ?? 2.0,
    leverage: raw.leverage ?? 10,
    quantity: raw.quantity ?? 0.1,
    stopLossPercent: raw.stopLossPct ?? raw.stopLossPercent ?? 1.5,
    takeProfitPercent: raw.takeProfitPct ?? raw.takeProfitPercent ?? 3.0,
    maxOpenPositions: raw.maxOpenPositions ?? 3,
    dailyLossLimit: raw.dailyLossLimit ?? 500,
    status: raw.status || 'STOPPED',
    totalTrades: raw.totalTrades ?? 0,
    winningTrades: raw.winningTrades ?? 0,
    losingTrades: raw.losingTrades ?? 0,
    totalPnl: raw.totalPnl ?? 0,
    lastSignal: raw.lastSignal,
    lastSignalReason: raw.lastSignalReasons || raw.lastSignalReason,
    lastEvaluatedAt: raw.lastRunAt || raw.lastEvaluatedAt,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt
  };
}

function mapStrategyToRequest(s: Partial<AlgoStrategy>): any {
  return {
    name: s.name || 'Ad-Hoc Strategy',
    symbol: s.symbol,
    market: s.marketType,
    tradingMode: s.tradingMode,
    timeframe: s.timeframe,
    direction: s.direction,
    emaFastPeriod: s.ema9Period ?? 9,
    emaSlowPeriod: s.ema21Period ?? 21,
    rsiPeriod: s.rsiPeriod ?? 14,
    rsiOverbought: s.rsiLongThreshold ?? 55,
    rsiOversold: s.rsiShortThreshold ?? 45,
    macdFast: s.macdFast ?? 12,
    macdSlow: s.macdSlow ?? 26,
    macdSignal: s.macdSignal ?? 9,
    bbPeriod: s.bollingerPeriod ?? 20,
    bbStdDev: s.bollingerStdDev ?? 2.0,
    useEmaCross: (s.condEmaCross !== false) && (s.useEma9 !== false || s.useEma21 !== false),
    useRsiFilter: (s.condRsiThreshold !== false) && (s.useRsi !== false),
    useMacdFilter: (s.condMacdDirection !== false) && (s.useMacd !== false),
    useBbFilter: (s.condBollingerBounce === true) && (s.useBollinger === true),
    riskPerTradePct: s.riskPerTradePercent ?? 2.0,
    leverage: s.leverage ?? 10,
    quantity: s.quantity ?? 0.1,
    stopLossPct: s.stopLossPercent ?? 1.5,
    takeProfitPct: s.takeProfitPercent ?? 3.0,
    maxOpenPositions: s.maxOpenPositions ?? 3,
    dailyLossLimit: s.dailyLossLimit ?? 500
  };
}

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
    return this.http.get<any[]>(`${this.baseUrl}/strategies`).pipe(
      map((list) => (list || []).map(mapBackendToStrategy)),
      tap((data) => this.strategies.set(data))
    );
  }

  getStrategyById(id: number): Observable<AlgoStrategy> {
    return this.http.get<any>(`${this.baseUrl}/strategies/${id}`).pipe(
      map(mapBackendToStrategy),
      tap((data) => this.activeStrategy.set(data))
    );
  }

  createStrategy(strategy: Partial<AlgoStrategy>): Observable<AlgoStrategy> {
    const payload = mapStrategyToRequest(strategy);
    return this.http.post<any>(`${this.baseUrl}/strategies`, payload).pipe(
      map(mapBackendToStrategy),
      tap((saved) => {
        this.strategies.update((list) => [saved, ...list]);
        this.activeStrategy.set(saved);
      })
    );
  }

  updateStrategy(id: number, strategy: Partial<AlgoStrategy>): Observable<AlgoStrategy> {
    const payload = mapStrategyToRequest(strategy);
    return this.http.put<any>(`${this.baseUrl}/strategies/${id}`, payload).pipe(
      map(mapBackendToStrategy),
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
  startStrategy(id: number): Observable<AlgoStrategy> {
    return this.http.post<any>(`${this.baseUrl}/strategies/${id}/start`, {}).pipe(
      map(mapBackendToStrategy),
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

  pauseStrategy(id: number): Observable<AlgoStrategy> {
    return this.http.post<any>(`${this.baseUrl}/strategies/${id}/pause`, {}).pipe(
      map(mapBackendToStrategy),
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
    return this.http.post<any>(`${this.baseUrl}/strategies/${id}/stop`, {}).pipe(
      map(mapBackendToStrategy),
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
  evaluateStrategy(id: number, execute: boolean = false): Observable<AlgoEvaluationResult> {
    const params = new HttpParams().set('execute', execute.toString());
    return this.http.get<AlgoEvaluationResult>(`${this.baseUrl}/strategies/${id}/evaluate`, { params }).pipe(
      tap((res) => this.evaluationResult.set(res))
    );
  }

  evaluateAdHoc(strategy: Partial<AlgoStrategy>): Observable<AlgoEvaluationResult> {
    const payload = mapStrategyToRequest(strategy);
    return this.http.post<AlgoEvaluationResult>(`${this.baseUrl}/evaluate`, payload).pipe(
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
