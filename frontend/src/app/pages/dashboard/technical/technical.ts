import {
  Component,
  OnInit,
  OnDestroy,
  AfterViewInit,
  ElementRef,
  ViewChild,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription, forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  CandlestickData,
  LineData,
  HistogramData,
  Time,
  ColorType
} from 'lightweight-charts';
import { MarketService } from '../../../services/market.service';
import { Candle, StockQuote } from '../../../models/market.model';
import {
  TechnicalSummary,
  computeAllTechnicalAnalysis,
  sortCandlesChronologically
} from '../../../utils/technical-analysis.utils';

@Component({
  selector: 'app-technical',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './technical.html',
  styleUrls: ['./technical.css']
})
export class TechnicalAnalysisComponent implements OnInit, OnDestroy, AfterViewInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly marketService = inject(MarketService);

  @ViewChild('priceChartContainer') priceChartContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('rsiChartContainer') rsiChartContainer?: ElementRef<HTMLDivElement>;
  @ViewChild('macdChartContainer') macdChartContainer?: ElementRef<HTMLDivElement>;

  readonly symbol = signal<string>('RELIANCE');
  readonly currentTimeframe = signal<string>('1D');
  readonly currentInterval = signal<string>('5min');
  readonly currentProvider = signal<string>('Upstox');
  readonly currentExchange = signal<string>('NSE');
  readonly currentCurrency = signal<string>('INR');
  readonly currentQuote = signal<StockQuote | null>(null);
  readonly candleData = signal<Candle[]>([]);
  readonly summary = signal<TechnicalSummary | null>(null);
  readonly isLoading = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  readonly searchQuery = signal<string>('');

  // Toggles for overlays and sub-charts
  readonly showEMA = signal<boolean>(true);
  readonly showSMA = signal<boolean>(true);
  readonly showRSI = signal<boolean>(true);
  readonly showMACD = signal<boolean>(true);

  readonly availableTimeframes: string[] = ['1D', '1W', '1M', '3M', '6M', '1Y'];

  private priceChart?: IChartApi;
  private candlestickSeries?: ISeriesApi<'Candlestick'>;
  private ema20Series?: ISeriesApi<'Line'>;
  private ema50Series?: ISeriesApi<'Line'>;
  private sma20Series?: ISeriesApi<'Line'>;
  private sma50Series?: ISeriesApi<'Line'>;

  private rsiChart?: IChartApi;
  private rsiSeries?: ISeriesApi<'Line'>;

  private macdChart?: IChartApi;
  private macdLineSeries?: ISeriesApi<'Line'>;
  private macdSignalSeries?: ISeriesApi<'Line'>;
  private macdHistSeries?: ISeriesApi<'Histogram'>;

  private routeSub?: Subscription;
  private resizeObserver?: ResizeObserver;

  ngOnInit(): void {
    this.routeSub = this.route.paramMap.subscribe(params => {
      const sym = params.get('symbol');
      const targetSymbol = (sym && sym.trim()) ? sym.trim().toUpperCase() : 'RELIANCE';
      this.symbol.set(targetSymbol);
      this.currentProvider.set(this.detectProvider(targetSymbol));
      this.currentExchange.set(this.detectExchange(targetSymbol));
      this.currentCurrency.set(this.detectCurrency(targetSymbol));
      this.loadTechnicalData(targetSymbol);
    });
  }

  ngAfterViewInit(): void {
    this.initCharts();
    if (typeof window !== 'undefined' && 'ResizeObserver' in window) {
      this.resizeObserver = new ResizeObserver(() => {
        this.handleResize();
      });
      if (this.priceChartContainer?.nativeElement) {
        this.resizeObserver.observe(this.priceChartContainer.nativeElement);
      }
    }
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
    this.resizeObserver?.disconnect();
    this.destroyCharts();
  }

  loadTechnicalData(symbol: string): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    const { interval, outputsize } = this.getTimeframeConfig(this.currentTimeframe());
    this.currentInterval.set(interval);
    const provider = this.detectProvider(symbol);
    this.currentProvider.set(provider);

    forkJoin({
      quote: this.marketService.getQuote(symbol).pipe(
        catchError(() => of(null))
      ),
      candles: this.marketService.getCandles(symbol, interval, outputsize).pipe(
        catchError(err => {
          const msg = err?.error?.message || err?.message || 'Data unavailable for ' + symbol;
          this.errorMessage.set(msg);
          return of(null);
        })
      )
    }).subscribe({
      next: ({ quote, candles }) => {
        this.isLoading.set(false);
        if (quote) {
          this.currentQuote.set(quote);
        }

        if (candles && candles.candles && candles.candles.length > 0) {
          if (candles.exchange) this.currentExchange.set(candles.exchange);
          if (candles.currency) this.currentCurrency.set(candles.currency);

          const sorted = sortCandlesChronologically(candles.candles);
          this.candleData.set(sorted);

          // Compute all deterministic technical indicators from real historical data
          const techSummary = computeAllTechnicalAnalysis(
            symbol,
            sorted,
            this.currentTimeframe(),
            interval,
            provider
          );
          this.summary.set(techSummary);

          // Update chart renderings
          this.updateChartsWithData(sorted, techSummary);
        } else {
          if (!this.errorMessage()) {
            this.errorMessage.set('Insufficient historical candles returned for ' + symbol);
          }
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        const msg = err?.error?.message || err?.message || 'Failed to load technical analysis data.';
        this.errorMessage.set(msg);
      }
    });
  }

  refreshData(): void {
    this.loadTechnicalData(this.symbol());
  }

  setTimeframe(tf: string): void {
    if (this.currentTimeframe() === tf) return;
    this.currentTimeframe.set(tf);
    this.loadTechnicalData(this.symbol());
  }

  onSearchInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchQuery.set(input?.value || '');
  }

  onSearchEnter(): void {
    const query = this.searchQuery().trim().toUpperCase();
    if (!query) return;
    this.router.navigate(['/dashboard/technical', query]);
    this.searchQuery.set('');
  }

  toggleEMA(): void {
    this.showEMA.update(v => !v);
    this.renderOverlays();
  }

  toggleSMA(): void {
    this.showSMA.update(v => !v);
    this.renderOverlays();
  }

  toggleRSI(): void {
    this.showRSI.update(v => !v);
    setTimeout(() => {
      this.initRsiChart();
      const s = this.summary();
      if (s) this.renderRsi(s);
    }, 50);
  }

  toggleMACD(): void {
    this.showMACD.update(v => !v);
    setTimeout(() => {
      this.initMacdChart();
      const s = this.summary();
      if (s) this.renderMacd(s);
    }, 50);
  }

  getCurrencySymbol(currency?: string): string {
    const cur = currency || this.currentCurrency();
    if (cur === 'INR') return '₹';
    if (cur === 'EUR') return '€';
    if (cur === 'GBP') return '£';
    return '$';
  }

  getRsiCondition(value: number | null): string {
    if (value === null) return 'N/A';
    if (value >= 70) return 'Overbought';
    if (value <= 30) return 'Oversold';
    return 'Neutral';
  }

  getRsiBadgeClass(value: number | null): string {
    if (value === null) return 'badge-neutral';
    if (value >= 70) return 'badge-overbought';
    if (value <= 30) return 'badge-oversold';
    return 'badge-neutral';
  }

  private detectProvider(symbol: string): string {
    const upper = symbol.toUpperCase().trim();
    if (
      upper.startsWith('NSE_') ||
      upper.startsWith('BSE_') ||
      upper.includes('NIFTY') ||
      upper === 'SENSEX' ||
      ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'SBIN', 'BHARTIARTL', 'ITC', 'KOTAKBANK', 'LT'].includes(upper)
    ) {
      return 'Upstox';
    }
    return 'Twelve Data';
  }

  private detectExchange(symbol: string): string {
    const upper = symbol.toUpperCase().trim();
    if (upper.includes('BSE') || upper === 'SENSEX') return 'BSE';
    if (upper.startsWith('NSE_') || upper.includes('NIFTY') || ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'SBIN', 'BHARTIARTL', 'ITC', 'KOTAKBANK', 'LT'].includes(upper)) {
      return 'NSE';
    }
    if (upper.includes('/')) return upper.includes('BTC') || upper.includes('ETH') || upper.includes('SOL') ? 'Crypto' : 'Forex';
    return 'NASDAQ';
  }

  private detectCurrency(symbol: string): string {
    const upper = symbol.toUpperCase().trim();
    if (this.detectProvider(upper) === 'Upstox') return 'INR';
    if (upper.startsWith('EUR/')) return 'USD';
    return 'USD';
  }

  private getTimeframeConfig(tf: string): { interval: string; outputsize: number } {
    switch (tf) {
      case '1D': return { interval: '5min', outputsize: 75 };
      case '1W': return { interval: '15min', outputsize: 150 };
      case '1M': return { interval: '1h', outputsize: 160 };
      case '3M': return { interval: '1h', outputsize: 300 };
      case '6M': return { interval: '1day', outputsize: 180 };
      case '1Y': return { interval: '1day', outputsize: 365 };
      default: return { interval: '5min', outputsize: 75 };
    }
  }

  // ==========================================================================
  // CHART MANAGEMENT (Lightweight Charts)
  // ==========================================================================
  private initCharts(): void {
    if (!this.priceChartContainer?.nativeElement) return;
    try {
      const container = this.priceChartContainer.nativeElement;
      const width = container.clientWidth || 800;
      const height = 440;

      this.priceChart = createChart(container, {
        width,
        height,
        layout: {
          background: { type: ColorType.Solid, color: 'transparent' },
          textColor: '#94a3b8'
        },
        grid: {
          vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
          horzLines: { color: 'rgba(255, 255, 255, 0.05)' }
        },
        timeScale: {
          borderColor: 'rgba(255, 255, 255, 0.1)',
          timeVisible: true
        }
      });

      this.candlestickSeries = this.priceChart.addSeries(CandlestickSeries, {
        upColor: '#10b981',
        downColor: '#ef4444',
        borderVisible: false,
        wickUpColor: '#10b981',
        wickDownColor: '#ef4444'
      });

      this.ema20Series = this.priceChart.addSeries(LineSeries, { color: '#3b82f6', lineWidth: 2 });
      this.ema50Series = this.priceChart.addSeries(LineSeries, { color: '#8b5cf6', lineWidth: 2 });
      this.sma20Series = this.priceChart.addSeries(LineSeries, { color: '#f59e0b', lineWidth: 2 });
      this.sma50Series = this.priceChart.addSeries(LineSeries, { color: '#ec4899', lineWidth: 2 });

      if (this.showRSI()) this.initRsiChart();
      if (this.showMACD()) this.initMacdChart();
    } catch (e) {
      // Safe fallback in test or headless environments
    }
  }

  private initRsiChart(): void {
    if (!this.rsiChartContainer?.nativeElement) return;
    try {
      if (this.rsiChart) {
        this.rsiChart.remove();
      }
      const container = this.rsiChartContainer.nativeElement;
      const width = container.clientWidth || 800;

      this.rsiChart = createChart(container, {
        width,
        height: 160,
        layout: {
          background: { type: ColorType.Solid, color: 'transparent' },
          textColor: '#94a3b8'
        },
        grid: {
          vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
          horzLines: { color: 'rgba(255, 255, 255, 0.05)' }
        },
        timeScale: {
          borderColor: 'rgba(255, 255, 255, 0.1)',
          timeVisible: true
        }
      });

      this.rsiSeries = this.rsiChart.addSeries(LineSeries, {
        color: '#38bdf8',
        lineWidth: 2
      });
    } catch (e) {}
  }

  private initMacdChart(): void {
    if (!this.macdChartContainer?.nativeElement) return;
    try {
      if (this.macdChart) {
        this.macdChart.remove();
      }
      const container = this.macdChartContainer.nativeElement;
      const width = container.clientWidth || 800;

      this.macdChart = createChart(container, {
        width,
        height: 160,
        layout: {
          background: { type: ColorType.Solid, color: 'transparent' },
          textColor: '#94a3b8'
        },
        grid: {
          vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
          horzLines: { color: 'rgba(255, 255, 255, 0.05)' }
        },
        timeScale: {
          borderColor: 'rgba(255, 255, 255, 0.1)',
          timeVisible: true
        }
      });

      this.macdHistSeries = this.macdChart.addSeries(HistogramSeries, {});
      this.macdLineSeries = this.macdChart.addSeries(LineSeries, { color: '#3b82f6', lineWidth: 2 });
      this.macdSignalSeries = this.macdChart.addSeries(LineSeries, { color: '#f59e0b', lineWidth: 2 });
    } catch (e) {}
  }

  private updateChartsWithData(candles: Candle[], summary: TechnicalSummary): void {
    if (!this.candlestickSeries) return;
    try {
      const candlePoints: CandlestickData<Time>[] = candles.map(c => ({
        time: (c.timestamp as unknown) as Time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close
      }));

      this.candlestickSeries.setData(candlePoints);
      this.renderOverlays();
      this.renderRsi(summary);
      this.renderMacd(summary);
    } catch (e) {}
  }

  private renderOverlays(): void {
    const s = this.summary();
    if (!s) return;

    try {
      if (this.ema20Series) {
        this.ema20Series.setData(
          this.showEMA() && s.ema20.isSufficient
            ? s.ema20.data.map(p => ({ time: (p.time as unknown) as Time, value: p.value }))
            : []
        );
      }

      if (this.ema50Series) {
        this.ema50Series.setData(
          this.showEMA() && s.ema50.isSufficient
            ? s.ema50.data.map(p => ({ time: (p.time as unknown) as Time, value: p.value }))
            : []
        );
      }

      if (this.sma20Series) {
        this.sma20Series.setData(
          this.showSMA() && s.sma20.isSufficient
            ? s.sma20.data.map(p => ({ time: (p.time as unknown) as Time, value: p.value }))
            : []
        );
      }

      if (this.sma50Series) {
        this.sma50Series.setData(
          this.showSMA() && s.sma50.isSufficient
            ? s.sma50.data.map(p => ({ time: (p.time as unknown) as Time, value: p.value }))
            : []
        );
      }
    } catch (e) {}
  }

  private renderRsi(summary: TechnicalSummary): void {
    if (!this.rsiSeries || !this.showRSI()) return;
    try {
      if (summary.rsi14.isSufficient) {
        const points: LineData<Time>[] = summary.rsi14.data.map(p => ({
          time: (p.time as unknown) as Time,
          value: p.value
        }));
        this.rsiSeries.setData(points);
      } else {
        this.rsiSeries.setData([]);
      }
    } catch (e) {}
  }

  private renderMacd(summary: TechnicalSummary): void {
    if (!this.showMACD()) return;
    try {
      if (summary.macd.isSufficient) {
        if (this.macdLineSeries) {
          this.macdLineSeries.setData(
            summary.macd.macdLine.map(p => ({ time: (p.time as unknown) as Time, value: p.value }))
          );
        }
        if (this.macdSignalSeries) {
          this.macdSignalSeries.setData(
            summary.macd.signalLine.map(p => ({ time: (p.time as unknown) as Time, value: p.value }))
          );
        }
        if (this.macdHistSeries) {
          this.macdHistSeries.setData(
            summary.macd.histogram.map(p => ({
              time: (p.time as unknown) as Time,
              value: p.value,
              color: p.color
            }))
          );
        }
      } else {
        this.macdLineSeries?.setData([]);
        this.macdSignalSeries?.setData([]);
        this.macdHistSeries?.setData([]);
      }
    } catch (e) {}
  }

  private handleResize(): void {
    if (this.priceChartContainer?.nativeElement && this.priceChart) {
      const width = this.priceChartContainer.nativeElement.clientWidth;
      this.priceChart.applyOptions({ width });
      this.rsiChart?.applyOptions({ width });
      this.macdChart?.applyOptions({ width });
    }
  }

  private destroyCharts(): void {
    try {
      this.priceChart?.remove();
      this.rsiChart?.remove();
      this.macdChart?.remove();
    } catch (e) {}
  }
}
