import {
  Component,
  inject,
  OnInit,
  OnDestroy,
  signal,
  computed,
  ElementRef,
  viewChild,
  effect
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  CandlestickSeries,
  LineSeries,
  AreaSeries,
  HistogramSeries,
  ColorType,
  CrosshairMode,
  Time,
  CandlestickData,
  LineData,
  HistogramData
} from 'lightweight-charts';
import { MarketService } from '../../../services/market.service';
import { AuthService } from '../../../services/auth.service';
import { TradingService } from '../../../services/trading.service';
import { StockQuote, Candle } from '../../../models/market.model';
import { TradeResponse, VirtualWallet, UserHolding } from '../../../models/trading.model';

export type ChartType = 'candles' | 'line' | 'area';
export type TimeframeRange = '1D' | '1W' | '1M' | '3M' | '6M' | '1Y';

export interface HoveredBarData {
  timeStr: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number | null;
}

@Component({
  selector: 'app-stock-details',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './stock-details.html',
  styleUrl: './stock-details.css'
})
export class StockDetailsComponent implements OnInit, OnDestroy {
  readonly marketService = inject(MarketService);
  readonly authService = inject(AuthService);
  readonly tradingService = inject(TradingService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  // Chart Container DOM Reference
  readonly chartContainerRef = viewChild<ElementRef<HTMLDivElement>>('chartContainer');

  // Active Symbol & State
  readonly symbol = signal<string>('RELIANCE');
  readonly companyName = signal<string>('Reliance Industries Ltd');
  readonly exchange = signal<string>('NSE');
  readonly instrumentType = signal<string>('Stock');
  readonly currentQuote = signal<StockQuote | null>(null);

  // Provider routing identification
  readonly currentProvider = computed(() => {
    return this.marketService.isIndianSymbol(this.symbol()) ? 'Upstox' : 'Twelve Data';
  });

  // Loading and Error states
  readonly isLoadingQuote = signal<boolean>(false);
  readonly isLoadingCandles = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  readonly isRateLimited = signal<boolean>(false);

  // Chart Controls State
  readonly currentChartType = signal<ChartType>('candles');
  readonly currentTimeframe = signal<TimeframeRange>('1D');
  readonly isFullscreen = signal<boolean>(false);

  // Live Hovered Candle / Bar Info
  readonly hoveredBar = signal<HoveredBarData | null>(null);

  // Real Candlestick Data Cache
  readonly candleData = signal<Candle[]>([]);

  // Timeframe Ranges Available
  readonly timeframes: TimeframeRange[] = ['1D', '1W', '1M', '3M', '6M', '1Y'];

  // =========================================================================
  // SIMULATED TRADING STATE
  // =========================================================================
  readonly tradeType = signal<'BUY' | 'SELL'>('BUY');
  readonly tradeQuantity = signal<number>(1);
  readonly isSubmittingTrade = signal<boolean>(false);
  readonly tradeSuccessReceipt = signal<TradeResponse | null>(null);
  readonly tradeErrorMessage = signal<string | null>(null);
  readonly userWallet = signal<VirtualWallet | null>(null);
  readonly userHolding = signal<UserHolding | null>(null);

  // Estimated Total Amount Computed
  readonly estimatedTradeTotal = computed(() => {
    const price = this.currentQuote()?.price ?? 0;
    const qty = this.tradeQuantity() ?? 0;
    return price * qty;
  });

  // Validation Computed Properties
  readonly hasInsufficientBalance = computed(() => {
    if (this.tradeType() !== 'BUY') return false;
    const balance = this.userWallet()?.cashBalance ?? 0;
    return this.estimatedTradeTotal() > balance;
  });

  readonly hasInsufficientHoldings = computed(() => {
    if (this.tradeType() !== 'SELL') return false;
    const owned = this.userHolding()?.quantity ?? 0;
    return (this.tradeQuantity() ?? 0) > owned;
  });

  // Quick navigation chips
  readonly quickShortcuts = [
    { symbol: 'RELIANCE', name: 'Reliance Industries', category: 'stocks' },
    { symbol: 'TCS', name: 'Tata Consultancy Services', category: 'stocks' },
    { symbol: 'NIFTY 50', name: 'Nifty 50 Index', category: 'indices' },
    { symbol: 'BANK NIFTY', name: 'Nifty Bank Index', category: 'indices' },
    { symbol: 'AAPL', name: 'Apple Inc.', category: 'stocks' },
    { symbol: 'NVDA', name: 'NVIDIA Corp.', category: 'stocks' },
    { symbol: 'EUR/USD', name: 'Euro / USD', category: 'forex' },
    { symbol: 'BTC/USD', name: 'Bitcoin / USD', category: 'crypto' }
  ];

  // Lightweight Charts Instances
  private chart: IChartApi | null = null;
  private candlestickSeries: ISeriesApi<'Candlestick'> | null = null;
  private lineSeries: ISeriesApi<'Line'> | null = null;
  private areaSeries: ISeriesApi<'Area'> | null = null;
  private volumeSeries: ISeriesApi<'Histogram'> | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private paramSub?: Subscription;

  constructor() {
    // Effect to render or re-render chart whenever chartContainerRef and candleData become available
    effect(() => {
      const container = this.chartContainerRef()?.nativeElement;
      const data = this.candleData();
      const chartType = this.currentChartType();

      if (container && data && data.length > 0) {
        this.initOrUpdateChart(container, data, chartType);
      }
    });
  }

  ngOnInit(): void {
    this.paramSub = this.route.paramMap.subscribe(params => {
      const sym = params.get('symbol');
      if (sym && sym.trim().length > 0) {
        this.loadInstrumentData(decodeURIComponent(sym.trim()));
      } else {
        this.loadInstrumentData(this.symbol());
      }
    });

    if (this.authService.isAuthenticated()) {
      this.refreshTradingState();
    }
  }

  ngOnDestroy(): void {
    this.paramSub?.unsubscribe();
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.chart) {
      this.chart.remove();
      this.chart = null;
    }
  }

  // =========================================================================
  // INSTRUMENT DATA LOADING
  // =========================================================================

  loadInstrumentData(symbol: string): void {
    const cleanSym = symbol.trim().toUpperCase();
    if (!cleanSym) return;

    this.symbol.set(cleanSym);
    this.errorMessage.set(null);
    this.isRateLimited.set(false);
    this.tradeSuccessReceipt.set(null);
    this.tradeErrorMessage.set(null);

    // Derive display metadata
    if (cleanSym.includes('NIFTY') || cleanSym.includes('SENSEX')) {
      this.instrumentType.set('Index');
      this.exchange.set(cleanSym.includes('SENSEX') ? 'BSE' : 'NSE');
    } else if (cleanSym.includes('/')) {
      this.instrumentType.set(cleanSym.startsWith('BTC') || cleanSym.startsWith('ETH') || cleanSym.startsWith('SOL') ? 'Crypto' : 'Forex');
      this.exchange.set(this.instrumentType() === 'Crypto' ? 'Coinbase' : 'Forex');
    } else if (this.marketService.isIndianSymbol(cleanSym)) {
      this.instrumentType.set('Stock');
      this.exchange.set('NSE');
    } else {
      this.instrumentType.set('Stock');
      this.exchange.set('NASDAQ');
    }

    this.fetchQuote(cleanSym);
    this.fetchCandles(cleanSym, this.currentTimeframe());

    if (this.authService.isAuthenticated()) {
      this.refreshTradingState();
    }
  }

  fetchQuote(symbol: string): void {
    this.isLoadingQuote.set(true);

    this.marketService.getQuote(symbol).subscribe({
      next: (quote) => {
        this.isLoadingQuote.set(false);
        this.currentQuote.set(quote);
        if (quote.name) {
          this.companyName.set(quote.name);
        }
      },
      error: (err) => {
        this.isLoadingQuote.set(false);
        this.handleError(err, symbol);
      }
    });
  }

  fetchCandles(symbol: string, timeframe: TimeframeRange): void {
    this.isLoadingCandles.set(true);

    const { interval, outputsize } = this.getApiParamsForTimeframe(timeframe);

    this.marketService.getCandles(symbol, interval, outputsize).subscribe({
      next: (series) => {
        this.isLoadingCandles.set(false);
        if (series && series.candles && series.candles.length > 0) {
          this.candleData.set(series.candles);
          if (series.exchange) this.exchange.set(series.exchange);
          if (series.type) this.instrumentType.set(series.type);
        } else {
          this.candleData.set([]);
          this.errorMessage.set('Data unavailable');
        }
      },
      error: (err) => {
        this.isLoadingCandles.set(false);
        this.candleData.set([]);
        this.handleError(err, symbol);
      }
    });
  }

  refreshTradingState(): void {
    const sym = this.symbol();
    this.tradingService.getWallet().subscribe({
      next: (wallet) => this.userWallet.set(wallet),
      error: () => {}
    });

    this.tradingService.getHoldingForSymbol(sym).subscribe({
      next: (holding) => this.userHolding.set(holding),
      error: () => this.userHolding.set(null)
    });
  }

  private handleError(err: any, symbol: string): void {
    if (err.status === 429) {
      this.isRateLimited.set(true);
      this.errorMessage.set('Market data rate limit reached. Please try again shortly.');
    } else if (err.status === 404) {
      this.errorMessage.set('Data unavailable');
    } else if (err.status === 504) {
      this.errorMessage.set('Market data request timed out. Please try again.');
    } else {
      this.errorMessage.set(err.error?.message || err.message || 'Data unavailable');
    }
  }

  private getApiParamsForTimeframe(tf: TimeframeRange): { interval: string; outputsize: number } {
    switch (tf) {
      case '1D':
        return { interval: '5min', outputsize: 78 };
      case '1W':
        return { interval: '15min', outputsize: 130 };
      case '1M':
        return { interval: '1h', outputsize: 160 };
      case '3M':
        return { interval: '1day', outputsize: 90 };
      case '6M':
        return { interval: '1day', outputsize: 180 };
      case '1Y':
      default:
        return { interval: '1day', outputsize: 365 };
    }
  }

  // =========================================================================
  // LIGHTWEIGHT CHARTS RENDERING
  // =========================================================================

  private initOrUpdateChart(container: HTMLDivElement, candles: Candle[], chartType: ChartType): void {
    if (!container || candles.length === 0 || typeof window === 'undefined') return;

    try {
      if (!this.chart) {
        const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
        const bgColor = isDark ? '#08080a' : '#ffffff';
        const textColor = isDark ? '#a1a1aa' : '#475569';
        const gridColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(226, 232, 240, 0.6)';
        const borderColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(226, 232, 240, 0.8)';

        this.chart = createChart(container, {
          width: container.clientWidth || 800,
          height: container.clientHeight || 480,
          layout: {
            background: { type: ColorType.Solid, color: bgColor },
            textColor: textColor,
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Inter', monospace",
            fontSize: 11
          },
          grid: {
            vertLines: { color: gridColor },
            horzLines: { color: gridColor }
          },
          crosshair: {
            mode: CrosshairMode.Normal,
            vertLine: {
              width: 1,
              color: '#38bdf8',
              style: 3,
              labelBackgroundColor: '#0284c7'
            },
            horzLine: {
              width: 1,
              color: '#38bdf8',
              style: 3,
              labelBackgroundColor: '#0284c7'
            }
          },
          rightPriceScale: {
            borderColor: borderColor,
            visible: true,
            autoScale: true,
            scaleMargins: {
              top: 0.08,
              bottom: 0.22
            }
          },
          timeScale: {
            borderColor: borderColor,
            timeVisible: true,
            secondsVisible: false,
            fixLeftEdge: false,
            fixRightEdge: false,
            shiftVisibleRangeOnNewBar: true,
            rightOffset: 12,
            barSpacing: 10,
            minBarSpacing: 0.5
          }
        });

        // Track crosshair move for dynamic OHLC display
        this.chart.subscribeCrosshairMove((param) => {
          if (!param.time || !param.point) {
            const latest = candles[candles.length - 1];
            if (latest) {
              this.hoveredBar.set({
                timeStr: latest.datetime || new Date(latest.timestamp * 1000).toLocaleString(),
                open: latest.open,
                high: latest.high,
                low: latest.low,
                close: latest.close,
                volume: latest.volume
              });
            }
            return;
          }

          let bar: any = null;
          if (this.candlestickSeries && param.seriesData.has(this.candlestickSeries)) {
            bar = param.seriesData.get(this.candlestickSeries);
          } else if (this.lineSeries && param.seriesData.has(this.lineSeries)) {
            bar = param.seriesData.get(this.lineSeries);
          } else if (this.areaSeries && param.seriesData.has(this.areaSeries)) {
            bar = param.seriesData.get(this.areaSeries);
          }

          if (bar) {
            const timeVal = typeof param.time === 'number'
              ? new Date(param.time * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : String(param.time);

            this.hoveredBar.set({
              timeStr: timeVal,
              open: bar.open ?? bar.value ?? 0,
              high: bar.high ?? bar.value ?? 0,
              low: bar.low ?? bar.value ?? 0,
              close: bar.close ?? bar.value ?? 0,
              volume: null
            });
          }
        });

        if (typeof ResizeObserver !== 'undefined') {
          this.resizeObserver = new ResizeObserver((entries) => {
            if (entries.length === 0 || !this.chart) return;
            const { width, height } = entries[0].contentRect;
            this.chart.applyOptions({ width, height: height || 480 });
          });
          this.resizeObserver.observe(container);
        }
      }

      // Convert Candle Data
      const candleData: CandlestickData<Time>[] = candles.map(c => ({
        time: (c.timestamp as unknown) as Time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close
      }));

      const lineData: LineData<Time>[] = candles.map(c => ({
        time: (c.timestamp as unknown) as Time,
        value: c.close
      }));

      const volumeData: HistogramData<Time>[] = candles.map(c => ({
        time: (c.timestamp as unknown) as Time,
        value: c.volume || 0,
        color: c.close >= c.open ? 'rgba(16, 185, 129, 0.45)' : 'rgba(244, 63, 94, 0.45)'
      }));

      // Clear existing series
      if (this.candlestickSeries) {
        this.chart.removeSeries(this.candlestickSeries);
        this.candlestickSeries = null;
      }
      if (this.lineSeries) {
        this.chart.removeSeries(this.lineSeries);
        this.lineSeries = null;
      }
      if (this.areaSeries) {
        this.chart.removeSeries(this.areaSeries);
        this.areaSeries = null;
      }
      if (this.volumeSeries) {
        this.chart.removeSeries(this.volumeSeries);
        this.volumeSeries = null;
      }

      // Add Volume Series
      this.volumeSeries = this.chart.addSeries(HistogramSeries, {
        priceFormat: { type: 'volume' },
        priceScaleId: ''
      });
      this.volumeSeries.priceScale().applyOptions({
        scaleMargins: { top: 0.8, bottom: 0 }
      });
      this.volumeSeries.setData(volumeData);

      // Add Main Series
      if (chartType === 'candles') {
        this.candlestickSeries = this.chart.addSeries(CandlestickSeries, {
          upColor: '#10b981',
          downColor: '#f43f5e',
          borderVisible: false,
          wickUpColor: '#10b981',
          wickDownColor: '#f43f5e'
        });
        this.candlestickSeries.setData(candleData);
      } else if (chartType === 'line') {
        this.lineSeries = this.chart.addSeries(LineSeries, {
          color: '#38bdf8',
          lineWidth: 2
        });
        this.lineSeries.setData(lineData);
      } else if (chartType === 'area') {
        this.areaSeries = this.chart.addSeries(AreaSeries, {
          topColor: 'rgba(56, 189, 248, 0.4)',
          bottomColor: 'rgba(56, 189, 248, 0.02)',
          lineColor: '#38bdf8',
          lineWidth: 2
        });
        this.areaSeries.setData(lineData);
      }

      // Set initial hover bar
      const latest = candles[candles.length - 1];
      if (latest) {
        this.hoveredBar.set({
          timeStr: latest.datetime || new Date(latest.timestamp * 1000).toLocaleString(),
          open: latest.open,
          high: latest.high,
          low: latest.low,
          close: latest.close,
          volume: latest.volume
        });
      }

      this.chart.timeScale().fitContent();
    } catch (e) {
      // Ignore headless canvas error
    }
  }

  // =========================================================================
  // SIMULATED TRADING ACTIONS
  // =========================================================================

  setTradeType(type: 'BUY' | 'SELL'): void {
    this.tradeType.set(type);
    this.tradeErrorMessage.set(null);
    this.tradeSuccessReceipt.set(null);
  }

  setTradeQuantity(qty: number): void {
    const val = Math.max(1, Math.floor(qty || 1));
    this.tradeQuantity.set(val);
  }

  adjustQuantity(delta: number): void {
    const nextVal = Math.max(1, (this.tradeQuantity() || 1) + delta);
    this.tradeQuantity.set(nextVal);
  }

  setMaxQuantity(): void {
    const currentPrice = this.currentQuote()?.price;
    if (!currentPrice || currentPrice <= 0) return;

    if (this.tradeType() === 'BUY') {
      const balance = this.userWallet()?.cashBalance ?? 0;
      const maxAffordable = Math.floor(balance / currentPrice);
      this.tradeQuantity.set(Math.max(1, maxAffordable));
    } else {
      const owned = this.userHolding()?.quantity ?? 0;
      this.tradeQuantity.set(Math.max(1, Math.floor(owned)));
    }
  }

  submitTrade(): void {
    if (!this.authService.isAuthenticated()) {
      this.tradeErrorMessage.set('Please log in to execute simulated trades.');
      return;
    }

    const qty = this.tradeQuantity();
    if (!qty || qty <= 0) {
      this.tradeErrorMessage.set('Quantity must be greater than zero.');
      return;
    }

    const sym = this.symbol();
    this.isSubmittingTrade.set(true);
    this.tradeErrorMessage.set(null);
    this.tradeSuccessReceipt.set(null);

    const action$ = this.tradeType() === 'BUY'
      ? this.tradingService.buy({ symbol: sym, quantity: qty })
      : this.tradingService.sell({ symbol: sym, quantity: qty });

    action$.subscribe({
      next: (receipt) => {
        this.isSubmittingTrade.set(false);
        this.tradeSuccessReceipt.set(receipt);
        this.refreshTradingState();
      },
      error: (err) => {
        this.isSubmittingTrade.set(false);
        const errMsg = err.error?.message || err.message || 'Trade execution failed';
        this.tradeErrorMessage.set(errMsg);
      }
    });
  }

  dismissTradeSuccess(): void {
    this.tradeSuccessReceipt.set(null);
  }

  // =========================================================================
  // USER ACTIONS
  // =========================================================================

  setTimeframe(tf: TimeframeRange): void {
    this.currentTimeframe.set(tf);
    this.fetchCandles(this.symbol(), tf);
  }

  setChartType(type: ChartType): void {
    this.currentChartType.set(type);
  }

  fitChart(): void {
    if (this.chart) {
      this.chart.timeScale().fitContent();
      this.chart.priceScale('right').applyOptions({ autoScale: true });
    }
  }

  toggleFullscreen(): void {
    this.isFullscreen.update(v => !v);
    setTimeout(() => {
      if (this.chart && this.chartContainerRef()) {
        const container = this.chartContainerRef()!.nativeElement;
        this.chart.applyOptions({
          width: container.clientWidth,
          height: container.clientHeight
        });
        this.chart.timeScale().fitContent();
      }
    }, 150);
  }

  refreshData(): void {
    this.loadInstrumentData(this.symbol());
  }

  navigateToStock(sym: string): void {
    this.router.navigate(['/dashboard/stock', sym]);
  }

  formatCurrencySymbol(symbol?: string | null): string {
    if (!symbol) return '$';
    if (this.marketService.isIndianSymbol(symbol)) {
      return '₹';
    }
    if (symbol.includes('/')) {
      const parts = symbol.split('/');
      return parts[1] === 'USD' ? '$' : parts[1];
    }
    return '$';
  }

  getDayProgressPercent(quote: StockQuote): number {
    if (!quote.high || !quote.low || quote.high === quote.low || !quote.price) {
      return 50;
    }
    const range = quote.high - quote.low;
    const progress = ((quote.price - quote.low) / range) * 100;
    return Math.min(Math.max(progress, 0), 100);
  }
}
