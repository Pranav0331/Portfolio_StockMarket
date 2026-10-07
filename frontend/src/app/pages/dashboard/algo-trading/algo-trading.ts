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
import { RouterModule } from '@angular/router';
import { Subscription, interval, timer } from 'rxjs';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  IPriceLine,
  LineStyle,
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  Time,
  CandlestickData
} from 'lightweight-charts';
import { AlgoTradingService } from '../../../services/algo-trading.service';
import { MarketService } from '../../../services/market.service';
import { MarketWebSocketService, MarketTick } from '../../../services/market-websocket.service';
import { TradingService } from '../../../services/trading.service';
import { AuthService } from '../../../services/auth.service';
import {
  AlgoStrategy,
  AlgoEvaluationResult,
  AlgoPerformanceSummary,
  AlgoTradeLog,
  MarketType,
  TradingMode,
  StrategyDirection,
  StrategyStatus
} from '../../../models/algo-trading.model';
import { PositionItem, VirtualWallet } from '../../../models/trading.model';
import { StockQuote, Candle } from '../../../models/market.model';

@Component({
  selector: 'app-algo-trading',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './algo-trading.html',
  styleUrl: './algo-trading.css'
})
export class AlgoTradingComponent implements OnInit, OnDestroy {
  readonly algoService = inject(AlgoTradingService);
  readonly marketService = inject(MarketService);
  readonly marketWebSocketService = inject(MarketWebSocketService);
  readonly tradingService = inject(TradingService);
  readonly authService = inject(AuthService);

  readonly objectKeys = Object.keys;

  readonly chartContainerRef = viewChild<ElementRef<HTMLDivElement>>('chartContainer');

  // Active Symbol & Form Configuration
  readonly formStrategy = signal<AlgoStrategy>({
    name: 'EMA & RSI Trend Rider',
    symbol: 'BTC/USD',
    marketType: 'CRYPTO',
    tradingMode: 'INTRADAY',
    timeframe: '15m',
    direction: 'BOTH',
    useEma9: true,
    ema9Period: 9,
    useEma21: true,
    ema21Period: 21,
    useRsi: true,
    rsiPeriod: 14,
    rsiLongThreshold: 55,
    rsiShortThreshold: 45,
    useMacd: true,
    macdFast: 12,
    macdSlow: 26,
    macdSignal: 9,
    useBollinger: false,
    bollingerPeriod: 20,
    bollingerStdDev: 2.0,
    condEmaCross: true,
    condRsiThreshold: true,
    condMacdDirection: true,
    condBollingerBounce: false,
    isPaperTrading: true,
    virtualCapital: 100000,
    riskPerTradePercent: 2.0,
    leverage: 10,
    quantity: 0.1,
    stopLossPercent: 1.5,
    takeProfitPercent: 3.0,
    maxOpenPositions: 3,
    dailyLossLimit: 500,
    status: 'STOPPED',
    totalTrades: 0,
    winningTrades: 0,
    losingTrades: 0,
    totalPnl: 0
  });

  // Current Market & Live Price State
  readonly currentQuote = signal<StockQuote | null>(null);
  readonly currentPrice = signal<number>(0);
  readonly isMarketDataLoading = signal<boolean>(false);
  readonly marketDataError = signal<string | null>(null);

  // AI Analysis State
  readonly aiEvaluation = signal<AlgoEvaluationResult | null>(null);
  readonly isEvaluating = signal<boolean>(false);

  // Tabs & Views
  readonly activeBottomTab = signal<'logs' | 'positions' | 'performance' | 'strategies'>('logs');

  // Instrument quick-pick list
  readonly popularInstruments: { [key in MarketType]: { symbol: string; name: string }[] } = {
    CRYPTO: [
      { symbol: 'BTC/USD', name: 'Bitcoin' },
      { symbol: 'ETH/USD', name: 'Ethereum' },
      { symbol: 'SOL/USD', name: 'Solana' }
    ],
    FOREX: [
      { symbol: 'EUR/USD', name: 'Euro / US Dollar' },
      { symbol: 'GBP/USD', name: 'British Pound / USD' },
      { symbol: 'USD/JPY', name: 'US Dollar / Yen' }
    ],
    US: [
      { symbol: 'AAPL', name: 'Apple Inc.' },
      { symbol: 'NVDA', name: 'NVIDIA Corp.' },
      { symbol: 'TSLA', name: 'Tesla Inc.' }
    ],
    INDIAN: [
      { symbol: 'RELIANCE', name: 'Reliance Industries' },
      { symbol: 'TCS', name: 'Tata Consultancy' },
      { symbol: 'HDFCBANK', name: 'HDFC Bank' }
    ]
  };

  // Provider label computed
  readonly providerName = computed(() => {
    return this.marketService.isIndianSymbol(this.formStrategy().symbol) ? 'Upstox' : 'Twelve Data';
  });

  // Calculated Risk/Margin Metrics
  readonly calculatedMargin = computed(() => {
    const strat = this.formStrategy();
    const price = this.currentPrice() > 0 ? this.currentPrice() : 100;
    const lev = Math.max(1, strat.leverage || 1);
    return (price * strat.quantity) / lev;
  });

  readonly calculatedMaxRisk = computed(() => {
    const strat = this.formStrategy();
    const price = this.currentPrice() > 0 ? this.currentPrice() : 100;
    const slPct = (strat.stopLossPercent || 1) / 100;
    return price * strat.quantity * slPct;
  });

  readonly calculatedPositionSize = computed(() => {
    const strat = this.formStrategy();
    const price = this.currentPrice() > 0 ? this.currentPrice() : 100;
    return price * strat.quantity;
  });

  // Chart References
  private chart: IChartApi | null = null;
  private candleSeries: ISeriesApi<'Candlestick'> | null = null;
  private currentPriceLine: IPriceLine | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private themeObserver: MutationObserver | null = null;

  private subscriptions: Subscription[] = [];
  private liveEvalTimer: Subscription | null = null;

  constructor() {
    // Reactively recreate or resize chart on container ready
    effect(() => {
      const container = this.chartContainerRef();
      if (container && !this.chart) {
        this.initChart(container.nativeElement);
      }
    });
  }

  ngOnInit(): void {
    this.loadInitialData();
    this.subscribeWebSocket();
    this.startEvaluationLoop();
    this.observeThemeChanges();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((s) => s.unsubscribe());
    if (this.liveEvalTimer) this.liveEvalTimer.unsubscribe();
    if (this.resizeObserver) this.resizeObserver.disconnect();
    if (this.themeObserver) {
      this.themeObserver.disconnect();
      this.themeObserver = null;
    }
    if (this.chart) {
      this.chart.remove();
      this.chart = null;
    }
    this.marketWebSocketService.unsubscribe(this.formStrategy().symbol);
  }

  private observeThemeChanges(): void {
    if (typeof MutationObserver !== 'undefined' && typeof document !== 'undefined') {
      this.themeObserver = new MutationObserver(() => {
        this.applyChartTheme();
      });
      this.themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-theme', 'class']
      });
      this.themeObserver.observe(document.body, {
        attributes: true,
        attributeFilter: ['class']
      });
    }
  }

  private loadInitialData(): void {
    // Load wallet
    this.tradingService.getWallet().subscribe({ error: () => {} });

    // Load open positions
    this.tradingService.getPositions(undefined, 'OPEN').subscribe({ error: () => {} });

    // Load saved strategies
    this.algoService.getStrategies().subscribe({
      next: (list) => {
        if (list && list.length > 0) {
          const firstRunning = list.find((s) => s.status === 'RUNNING') || list[0];
          this.selectStrategy(firstRunning);
        } else {
          this.onSymbolChanged();
        }
      },
      error: () => this.onSymbolChanged()
    });

    // Load all trade logs
    this.algoService.getAllTradeLogs().subscribe({ error: () => {} });
  }

  onMarketTypeChange(market: MarketType): void {
    const strat = { ...this.formStrategy(), marketType: market };
    const defaultSym = this.popularInstruments[market][0].symbol;
    strat.symbol = defaultSym;
    this.formStrategy.set(strat);
    this.onSymbolChanged();
  }

  selectInstrument(sym: string): void {
    this.formStrategy.update((s) => ({ ...s, symbol: sym }));
    this.onSymbolChanged();
  }

  onSymbolChanged(): void {
    const symbol = this.formStrategy().symbol.trim().toUpperCase();
    if (!symbol) return;

    this.marketDataError.set(null);
    this.isMarketDataLoading.set(true);

    // Subscribe to symbol in WS
    this.marketWebSocketService.subscribe(symbol);

    // Fetch quote
    this.marketService.getQuote(symbol).subscribe({
      next: (quote) => {
        this.currentQuote.set(quote);
        if (quote && quote.price) {
          this.currentPrice.set(quote.price);
          this.updatePriceLine(quote.price);
        }
      },
      error: (err) => {
        console.warn('Failed to load quote:', err);
      }
    });

    // Fetch Candles
    this.loadCandles(symbol, this.formStrategy().timeframe);

    // Trigger AI evaluation
    this.evaluateCurrentStrategy();
  }

  loadCandles(symbol: string, timeframe: string): void {
    const intervalMap: { [key: string]: string } = {
      '1m': '1min',
      '5m': '5min',
      '15m': '15min',
      '30m': '30min',
      '1h': '1h'
    };
    const mappedInterval = intervalMap[timeframe] || '15min';

    this.marketService.getCandles(symbol, mappedInterval, 100).subscribe({
      next: (series) => {
        this.isMarketDataLoading.set(false);
        if (series && series.candles && series.candles.length > 0) {
          this.marketDataError.set(null);
          this.renderCandles(series.candles);
          const lastCandle = series.candles[series.candles.length - 1];
          if (lastCandle && lastCandle.close) {
            this.currentPrice.set(lastCandle.close);
            this.updatePriceLine(lastCandle.close);
          }
        } else {
          this.marketDataError.set('No candle data available from ' + this.providerName());
        }
      },
      error: (err) => {
        this.isMarketDataLoading.set(false);
        this.marketDataError.set('Market data unavailable from ' + this.providerName());
      }
    });
  }

  private subscribeWebSocket(): void {
    const sub = this.marketWebSocketService.ticks$.subscribe((tick: MarketTick | null) => {
      if (!tick) return;
      const currentSym = this.formStrategy().symbol.trim().toUpperCase();
      if (tick.symbol && tick.symbol.toUpperCase() === currentSym && tick.price !== undefined) {
        this.currentPrice.set(tick.price);
        this.updatePriceLine(tick.price);
      }
    });
    this.subscriptions.push(sub);
  }

  private startEvaluationLoop(): void {
    // Poll/Evaluate live strategy every 8 seconds if active
    this.liveEvalTimer = interval(8000).subscribe(() => {
      const strat = this.formStrategy();
      if (strat.id && strat.status === 'RUNNING') {
        this.algoService.evaluateStrategy(strat.id).subscribe({
          next: (res) => {
            this.aiEvaluation.set(res);
            this.tradingService.getPositions(undefined, 'OPEN').subscribe({ error: () => {} });
            this.algoService.getStrategyTradeLogs(strat.id!).subscribe({ error: () => {} });
            this.algoService.getStrategyPerformance(strat.id!).subscribe({ error: () => {} });
          }
        });
      } else {
        this.evaluateCurrentStrategy();
      }
    });
  }

  evaluateCurrentStrategy(): void {
    const strat = this.formStrategy();
    if (!strat.symbol) return;
    this.isEvaluating.set(true);

    if (strat.id) {
      this.algoService.evaluateStrategy(strat.id).subscribe({
        next: (res) => {
          this.aiEvaluation.set(res);
          this.isEvaluating.set(false);
        },
        error: () => {
          this.aiEvaluation.set(null);
          this.isEvaluating.set(false);
        }
      });
    } else {
      this.algoService.evaluateMarket(strat.symbol, strat.timeframe).subscribe({
        next: (res) => {
          this.aiEvaluation.set(res);
          this.isEvaluating.set(false);
        },
        error: () => {
          this.aiEvaluation.set(null);
          this.isEvaluating.set(false);
        }
      });
    }
  }

  // Strategy Execution Actions
  startAlgo(): void {
    const strat = this.formStrategy();
    if (!strat.id) {
      // Save strategy first then start
      this.saveStrategy(() => {
        if (this.formStrategy().id) {
          this.triggerStart(this.formStrategy().id!);
        }
      });
    } else {
      this.triggerStart(strat.id);
    }
  }

  private triggerStart(id: number): void {
    this.algoService.startStrategy(id).subscribe({
      next: (evalResult) => {
        this.aiEvaluation.set(evalResult);
        this.formStrategy.update((s) => ({ ...s, status: 'RUNNING' }));
        this.tradingService.getPositions(undefined, 'OPEN').subscribe({ error: () => {} });
        this.tradingService.getWallet().subscribe({ error: () => {} });
        this.algoService.getStrategyTradeLogs(id).subscribe({ error: () => {} });
      },
      error: (err) => {
        alert(err?.error?.message || 'Failed to start algorithm.');
      }
    });
  }

  pauseAlgo(): void {
    const strat = this.formStrategy();
    if (!strat.id) return;
    this.algoService.pauseStrategy(strat.id).subscribe({
      next: (res) => {
        this.formStrategy.update((s) => ({ ...s, status: 'PAUSED' }));
      }
    });
  }

  stopAlgo(): void {
    const strat = this.formStrategy();
    if (!strat.id) return;
    this.algoService.stopStrategy(strat.id).subscribe({
      next: (res) => {
        this.formStrategy.update((s) => ({ ...s, status: 'STOPPED' }));
      }
    });
  }

  saveStrategy(callback?: () => void): void {
    const strat = this.formStrategy();
    if (strat.id) {
      this.algoService.updateStrategy(strat.id, strat).subscribe({
        next: (saved) => {
          this.formStrategy.set(saved);
          if (callback) callback();
        }
      });
    } else {
      this.algoService.createStrategy(strat).subscribe({
        next: (saved) => {
          this.formStrategy.set(saved);
          if (callback) callback();
        }
      });
    }
  }

  selectStrategy(strat: AlgoStrategy): void {
    this.formStrategy.set({ ...strat });
    this.onSymbolChanged();
    if (strat.id) {
      this.algoService.getStrategyPerformance(strat.id).subscribe({ error: () => {} });
      this.algoService.getStrategyTradeLogs(strat.id).subscribe({ error: () => {} });
    }
  }

  deleteStrategy(strat: AlgoStrategy, event: Event): void {
    event.stopPropagation();
    if (!strat.id) return;
    if (confirm(`Are you sure you want to delete strategy "${strat.name}"?`)) {
      this.algoService.deleteStrategy(strat.id).subscribe({
        next: () => {
          if (this.formStrategy().id === strat.id) {
            this.formStrategy.update((s) => ({ ...s, id: undefined, status: 'STOPPED' }));
          }
        }
      });
    }
  }

  closeOpenPosition(pos: PositionItem): void {
    this.tradingService.closePosition(pos.id).subscribe({
      next: () => {
        this.tradingService.getPositions(undefined, 'OPEN').subscribe({ error: () => {} });
        this.tradingService.getWallet().subscribe({ error: () => {} });
        if (this.formStrategy().id) {
          this.algoService.getStrategyTradeLogs(this.formStrategy().id!).subscribe({ error: () => {} });
          this.algoService.getStrategyPerformance(this.formStrategy().id!).subscribe({ error: () => {} });
        }
      }
    });
  }

  // Lightweight Charts Initialization
  private initChart(container: HTMLDivElement): void {
    const isLight = typeof document !== 'undefined' && (
      document.documentElement.getAttribute('data-theme') === 'light' ||
      document.body.classList.contains('light-theme')
    );

    this.chart = createChart(container, {
      width: container.clientWidth || 600,
      height: 400,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: isLight ? '#475569' : '#94a3b8'
      },
      grid: {
        vertLines: { color: isLight ? 'rgba(15, 23, 42, 0.06)' : 'rgba(255, 255, 255, 0.04)' },
        horzLines: { color: isLight ? 'rgba(15, 23, 42, 0.06)' : 'rgba(255, 255, 255, 0.04)' }
      },
      crosshair: {
        mode: CrosshairMode.Normal
      },
      timeScale: {
        borderColor: isLight ? 'rgba(15, 23, 42, 0.12)' : 'rgba(255, 255, 255, 0.1)',
        timeVisible: true,
        secondsVisible: false
      }
    });

    this.candleSeries = this.chart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#ef4444',
      borderUpColor: '#10b981',
      borderDownColor: '#ef4444',
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444'
    });

    this.resizeObserver = new ResizeObserver((entries) => {
      if (entries.length > 0 && this.chart && container) {
        this.chart.applyOptions({
          width: container.clientWidth,
          height: container.clientHeight || 400
        });
      }
    });
    this.resizeObserver.observe(container);
  }

  private applyChartTheme(): void {
    if (!this.chart) return;
    const isLight = typeof document !== 'undefined' && (
      document.documentElement.getAttribute('data-theme') === 'light' ||
      document.body.classList.contains('light-theme')
    );

    this.chart.applyOptions({
      layout: {
        textColor: isLight ? '#475569' : '#94a3b8'
      },
      grid: {
        vertLines: { color: isLight ? 'rgba(15, 23, 42, 0.06)' : 'rgba(255, 255, 255, 0.04)' },
        horzLines: { color: isLight ? 'rgba(15, 23, 42, 0.06)' : 'rgba(255, 255, 255, 0.04)' }
      },
      timeScale: {
        borderColor: isLight ? 'rgba(15, 23, 42, 0.12)' : 'rgba(255, 255, 255, 0.1)'
      }
    });
  }

  private renderCandles(candles: Candle[]): void {
    if (!this.candleSeries) return;

    const formatted: CandlestickData<Time>[] = candles
      .filter((c) => c && c.timestamp && c.close)
      .map((c) => {
        let t: Time;
        const d = new Date(c.timestamp);
        if (!isNaN(d.getTime())) {
          t = Math.floor(d.getTime() / 1000) as Time;
        } else {
          t = c.timestamp as Time;
        }
        return {
          time: t,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close
        };
      })
      .sort((a, b) => (Number(a.time) || 0) - (Number(b.time) || 0));

    // Remove duplicates
    const unique: CandlestickData<Time>[] = [];
    const seen = new Set<string>();
    for (const item of formatted) {
      const key = String(item.time);
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(item);
      }
    }

    try {
      this.candleSeries.setData(unique);
      this.chart?.timeScale().fitContent();
    } catch (e) {
      console.warn('Error setting candle data:', e);
    }
  }

  private updatePriceLine(price: number): void {
    if (!this.candleSeries || !price) return;
    if (this.currentPriceLine) {
      this.candleSeries.removePriceLine(this.currentPriceLine);
    }
    this.currentPriceLine = this.candleSeries.createPriceLine({
      price: price,
      color: '#3b82f6',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: 'LIVE'
    });
  }
}
