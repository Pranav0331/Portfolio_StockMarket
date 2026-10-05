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
  IPriceLine,
  LineStyle,
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
import { AlertService } from '../../../services/alert.service';
import { StockQuote, Candle } from '../../../models/market.model';
import {
  TradeResponse,
  VirtualWallet,
  UserHolding,
  TradingMode,
  PositionSide,
  PositionItem
} from '../../../models/trading.model';
import { AlertConditionType } from '../../../models/alert.model';

export type ChartType = 'candles' | 'line' | 'area';
export type StockDetailInterval = '1min' | '5min' | '15min' | '30min' | '1h' | '4h' | '1day' | '1week';
export type TimeframeRange = '1D' | '1W' | '1M' | '3M' | '6M' | '1Y';

export interface IntervalOption {
  label: string;
  value: StockDetailInterval;
  outputsize: number;
}

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
  readonly alertService = inject(AlertService);
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
  readonly currentInterval = signal<StockDetailInterval>('5min');
  readonly currentTimeframe = signal<TimeframeRange>('1D');
  readonly isFullscreen = signal<boolean>(false);

  // Live Hovered Candle / Bar Info
  readonly hoveredBar = signal<HoveredBarData | null>(null);

  // Real Candlestick Data Cache
  readonly candleData = signal<Candle[]>([]);

  // Timeframe / Interval Options Available (1m, 5m, 15m, 30m, 1H, 4H, 1D, 1W)
  readonly intervals: IntervalOption[] = [
    { label: '1m', value: '1min', outputsize: 100 },
    { label: '5m', value: '5min', outputsize: 100 },
    { label: '15m', value: '15min', outputsize: 100 },
    { label: '30m', value: '30min', outputsize: 100 },
    { label: '1H', value: '1h', outputsize: 120 },
    { label: '4H', value: '4h', outputsize: 120 },
    { label: '1D', value: '1day', outputsize: 180 },
    { label: '1W', value: '1week', outputsize: 260 }
  ];

  // Range Ranges Available
  readonly timeframes: TimeframeRange[] = ['1D', '1W', '1M', '3M', '6M', '1Y'];

  // =========================================================================
  // PRICE ALERT MODAL STATE
  // =========================================================================
  readonly isAlertModalOpen = signal<boolean>(false);
  readonly alertCondition = signal<AlertConditionType>('ABOVE');
  readonly alertTargetPrice = signal<number>(100);
  readonly alertNotes = signal<string>('');
  readonly isSavingAlert = signal<boolean>(false);
  readonly alertErrorMessage = signal<string | null>(null);
  readonly alertSuccessMessage = signal<string | null>(null);

  // =========================================================================
  // EXNESS-STYLE SIMULATED TRADING STATE
  // =========================================================================
  readonly tradeSide = signal<PositionSide>('LONG');
  readonly tradeQuantity = signal<number>(1);
  readonly selectedTradingMode = signal<TradingMode>('INTRADAY');
  readonly selectedLeverage = signal<number>(10);
  readonly stopLossPrice = signal<number | null>(null);
  readonly takeProfitPrice = signal<number | null>(null);

  readonly isSubmittingTrade = signal<boolean>(false);
  readonly isClosingPositionId = signal<number | null>(null);
  readonly tradeSuccessReceipt = signal<TradeResponse | null>(null);
  readonly tradeErrorMessage = signal<string | null>(null);

  readonly userWallet = signal<VirtualWallet | null>(null);
  readonly userHolding = signal<UserHolding | null>(null);
  readonly userPositions = signal<PositionItem[]>([]);

  readonly leverageOptions = [1, 2, 5, 10, 20, 50, 100];

  readonly tradingModesList: { mode: TradingMode; label: string; desc: string; badge: string; icon: string }[] = [
    { mode: 'SCALPING', label: 'Scalping', desc: '1m / 5m / 15m momentum trades with dynamic leverage & tight execution', badge: '1m - 15m', icon: '⚡' },
    { mode: 'INTRADAY', label: 'Intraday', desc: '5m / 15m / 30m / 1H same-day trading with leverage up to 1:100', badge: 'Same Day', icon: '⏱️' },
    { mode: 'SWING', label: 'Swing', desc: 'Multi-day momentum and trend holding across sessions (Spot 1:1)', badge: 'Multi-Day', icon: '📈' },
    { mode: 'LONG_TERM', label: 'Long Term', desc: 'Fundamental investment and long-duration wealth holding (Spot 1:1)', badge: 'Long Hold', icon: '💎' }
  ];

  readonly currentTradingModeInfo = computed(() => {
    return this.tradingModesList.find(m => m.mode === this.selectedTradingMode()) || this.tradingModesList[1];
  });

  readonly isLeverageEnabled = computed(() => {
    return this.selectedTradingMode() === 'SCALPING' || this.selectedTradingMode() === 'INTRADAY';
  });

  readonly effectiveLeverage = computed(() => {
    return this.isLeverageEnabled() ? this.selectedLeverage() : 1;
  });

  // Position Value = Quantity * Entry Price
  readonly positionValue = computed(() => {
    const price = this.currentQuote()?.price ?? 0;
    const qty = this.tradeQuantity() ?? 0;
    return price * qty;
  });

  // Required Margin = Position Value / Leverage
  readonly requiredMargin = computed(() => {
    const lev = this.effectiveLeverage();
    return lev > 0 ? this.positionValue() / lev : this.positionValue();
  });

  // Validation Computed Properties
  readonly hasInsufficientMargin = computed(() => {
    const balance = this.userWallet()?.cashBalance ?? 0;
    return this.requiredMargin() > balance;
  });

  readonly hasInsufficientHoldings = computed(() => {
    if (this.tradeSide() !== 'SHORT' || this.isLeverageEnabled()) return false;
    const owned = this.userHolding()?.quantity ?? 0;
    return (this.tradeQuantity() ?? 0) > owned;
  });

  // SL / TP projected P&L calculations
  readonly slProjection = computed(() => {
    const sl = this.stopLossPrice();
    const curP = this.currentQuote()?.price;
    const qty = this.tradeQuantity();
    const margin = this.requiredMargin();
    if (!sl || !curP || !qty || sl <= 0 || curP <= 0 || margin <= 0) return null;

    let pnl = 0;
    if (this.tradeSide() === 'LONG') {
      pnl = (sl - curP) * qty;
    } else {
      pnl = (curP - sl) * qty;
    }
    const roi = (pnl / margin) * 100;
    return { pnl, roi, valid: this.tradeSide() === 'LONG' ? sl < curP : sl > curP };
  });

  readonly tpProjection = computed(() => {
    const tp = this.takeProfitPrice();
    const curP = this.currentQuote()?.price;
    const qty = this.tradeQuantity();
    const margin = this.requiredMargin();
    if (!tp || !curP || !qty || tp <= 0 || curP <= 0 || margin <= 0) return null;

    let pnl = 0;
    if (this.tradeSide() === 'LONG') {
      pnl = (tp - curP) * qty;
    } else {
      pnl = (curP - tp) * qty;
    }
    const roi = (pnl / margin) * 100;
    return { pnl, roi, valid: this.tradeSide() === 'LONG' ? tp > curP : tp < curP };
  });

  // Active open positions for current symbol with live floating P&L
  readonly activeSymbolPositions = computed(() => {
    const curSym = this.symbol();
    const curP = this.currentQuote()?.price;
    return this.userPositions()
      .filter(p => p.symbol === curSym && p.status === 'OPEN')
      .map(p => {
        const livePrice = curP && curP > 0 ? curP : p.entryPrice;
        let floatingPnl = 0;
        if (p.side === 'LONG') {
          floatingPnl = (livePrice - p.entryPrice) * p.quantity;
        } else {
          floatingPnl = (p.entryPrice - livePrice) * p.quantity;
        }
        const margin = p.marginUsed > 0 ? p.marginUsed : (p.entryPrice * p.quantity);
        const floatingPnlPercent = margin > 0 ? (floatingPnl / margin) * 100 : 0;

        return {
          ...p,
          currentPrice: livePrice,
          unrealizedPnl: floatingPnl,
          unrealizedPnlPercent: floatingPnlPercent
        };
      });
  });

  // Total floating P&L across symbol positions
  readonly totalSymbolFloatingPnl = computed(() => {
    return this.activeSymbolPositions().reduce((acc, p) => acc + (p.unrealizedPnl || 0), 0);
  });

  // Live Terminal Session Time Clock
  readonly currentSessionTime = signal<string>('');
  private sessionClockTimer: any = null;

  // Margin & Account Analytics
  readonly usedMargin = computed(() => {
    const fromWallet = this.userWallet()?.marginUsed;
    if (fromWallet != null && fromWallet > 0) return fromWallet;
    return this.userPositions()
      .filter(p => p.status === 'OPEN')
      .reduce((acc, p) => acc + (p.marginUsed || 0), 0);
  });

  readonly freeMargin = computed(() => {
    const fromWallet = this.userWallet()?.freeMargin;
    if (fromWallet != null && fromWallet > 0) return fromWallet;
    return this.userWallet()?.cashBalance ?? 0;
  });

  readonly totalEquity = computed(() => {
    const cash = this.userWallet()?.cashBalance ?? 0;
    const used = this.usedMargin();
    return cash + used + this.totalSymbolFloatingPnl();
  });

  // Active Symbol's primary position (if open)
  readonly activeSymbolPrimaryPosition = computed(() => {
    const active = this.activeSymbolPositions();
    return active.length > 0 ? active[0] : null;
  });

  // =========================================================================
  // MODIFY POSITION MODAL STATE
  // =========================================================================
  readonly isModifyModalOpen = signal<boolean>(false);
  readonly modifyingPosition = signal<PositionItem | null>(null);
  readonly modifyStopLoss = signal<number | null>(null);
  readonly modifyTakeProfit = signal<number | null>(null);
  readonly isSavingModify = signal<boolean>(false);
  readonly modifyErrorMessage = signal<string | null>(null);
  readonly modifySuccessMessage = signal<string | null>(null);

  // =========================================================================
  // CLOSE POSITION CONFIRMATION MODAL STATE & PARTIAL CLOSE
  // =========================================================================
  readonly isCloseConfirmModalOpen = signal<boolean>(false);
  readonly closingPositionTarget = signal<PositionItem | null>(null);
  readonly closeQuantity = signal<number>(1);

  readonly closeQuantityValid = computed(() => {
    const pos = this.closingPositionTarget();
    const qty = this.closeQuantity();
    const curP = this.currentQuote()?.price;
    if (!pos || !qty || qty <= 0 || !curP || curP <= 0) return false;
    return qty <= pos.quantity + 0.00001;
  });

  readonly closeMarginToRelease = computed(() => {
    const pos = this.closingPositionTarget();
    const qty = this.closeQuantity();
    if (!pos || !qty || qty <= 0 || pos.quantity <= 0) return 0;
    const ratio = Math.min(1, qty / pos.quantity);
    return (pos.marginUsed || 0) * ratio;
  });

  readonly closeEstimatedPnl = computed(() => {
    const pos = this.closingPositionTarget();
    const qty = this.closeQuantity();
    const curP = this.currentQuote()?.price;
    if (!pos || !qty || qty <= 0 || !curP) return 0;

    if (pos.side === 'LONG') {
      return (curP - pos.entryPrice) * qty;
    } else {
      return (pos.entryPrice - curP) * qty;
    }
  });

  readonly closeEstimatedPnlPercent = computed(() => {
    const margin = this.closeMarginToRelease();
    const pnl = this.closeEstimatedPnl();
    if (margin <= 0) return 0;
    return (pnl / margin) * 100;
  });

  readonly closeRemainingQty = computed(() => {
    const pos = this.closingPositionTarget();
    const qty = this.closeQuantity();
    if (!pos) return 0;
    return Math.max(0, Number((pos.quantity - (qty || 0)).toFixed(4)));
  });

  readonly closeSettlementAmount = computed(() => {
    const margin = this.closeMarginToRelease();
    const pnl = this.closeEstimatedPnl();
    return Math.max(0, margin + pnl);
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
    { symbol: 'BTC/USD', name: 'BTC/USD', category: 'crypto' }
  ];

  // Lightweight Charts Instances
  private chart: IChartApi | null = null;
  private candlestickSeries: ISeriesApi<'Candlestick'> | null = null;
  private lineSeries: ISeriesApi<'Line'> | null = null;
  private areaSeries: ISeriesApi<'Area'> | null = null;
  private volumeSeries: ISeriesApi<'Histogram'> | null = null;
  private chartPriceLines: IPriceLine[] = [];
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

    // Effect to sync price lines on chart when open positions or active quote changes
    effect(() => {
      const positions = this.activeSymbolPositions();
      const quote = this.currentQuote();
      if (this.candlestickSeries || this.lineSeries) {
        this.updateChartPriceLines(positions);
      }
    });
  }

  ngOnInit(): void {
    this.updateSessionClock();
    if (typeof window !== 'undefined') {
      this.sessionClockTimer = setInterval(() => this.updateSessionClock(), 1000);
    }

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
    if (this.sessionClockTimer) {
      clearInterval(this.sessionClockTimer);
      this.sessionClockTimer = null;
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.chart) {
      this.chart.remove();
      this.chart = null;
    }
  }

  private updateSessionClock(): void {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const timeStr = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())} ${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())} UTC`;
    this.currentSessionTime.set(timeStr);
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
    this.stopLossPrice.set(null);
    this.takeProfitPrice.set(null);

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

    // Default interval recommendations based on initial mode
    if (this.selectedTradingMode() === 'SCALPING') {
      this.currentInterval.set('1min');
    } else if (this.selectedTradingMode() === 'INTRADAY') {
      this.currentInterval.set('5min');
    }

    // Fetch live quote and historical candle series
    this.fetchQuote(cleanSym);
    const opt = this.intervals.find(i => i.value === this.currentInterval());
    this.fetchCandlesByInterval(cleanSym, this.currentInterval(), opt ? opt.outputsize : 100);

    if (this.authService.isAuthenticated()) {
      this.refreshTradingState();
    }
  }

  fetchQuote(symbol: string): void {
    this.isLoadingQuote.set(true);
    this.marketService.getQuote(symbol).subscribe({
      next: (quote) => {
        this.currentQuote.set(quote);
        if (quote.name && quote.name !== symbol) {
          this.companyName.set(quote.name);
        }
        this.isLoadingQuote.set(false);
      },
      error: (err) => {
        this.isLoadingQuote.set(false);
        this.handleError(err, symbol);
      }
    });
  }

  fetchCandlesByInterval(symbol: string, interval: StockDetailInterval, outputsize: number): void {
    this.isLoadingCandles.set(true);
    this.errorMessage.set(null);

    this.marketService.getCandles(symbol, interval, outputsize).subscribe({
      next: (res) => {
        this.candleData.set(res?.candles || []);
        this.isLoadingCandles.set(false);
      },
      error: (err) => {
        this.isLoadingCandles.set(false);
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

    this.tradingService.getPositions(undefined, 'OPEN').subscribe({
      next: (positions) => this.userPositions.set(positions || []),
      error: () => this.userPositions.set([])
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
  // LIGHTWEIGHT CHARTS RENDERING & POSITION OVERLAYS
  // =========================================================================

  formatBarDateTime(timeVal: any): string {
    if (!timeVal) return '';
    if (typeof timeVal === 'number') {
      const d = new Date(timeVal * 1000);
      const pad = (n: number) => n.toString().padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    }
    if (typeof timeVal === 'object' && timeVal !== null && 'year' in timeVal) {
      const pad = (n: number) => n.toString().padStart(2, '0');
      const h = 'hour' in timeVal ? ` ${pad((timeVal as any).hour)}:${pad((timeVal as any).minute)}:${pad((timeVal as any).second || 0)}` : ' 00:00:00';
      return `${timeVal.year}-${pad(timeVal.month)}-${pad(timeVal.day)}${h}`;
    }
    if (typeof timeVal === 'string') {
      if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(timeVal)) {
        return timeVal;
      }
      if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(timeVal)) {
        return `${timeVal}:00`;
      }
      if (/^\d{4}-\d{2}-\d{2}$/.test(timeVal)) {
        return `${timeVal} 00:00:00`;
      }
      const d = new Date(timeVal);
      if (!isNaN(d.getTime())) {
        const pad = (n: number) => n.toString().padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
      }
      return timeVal;
    }
    return String(timeVal);
  }

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
              style: LineStyle.Dashed,
              labelBackgroundColor: '#0284c7'
            },
            horzLine: {
              width: 1,
              color: '#38bdf8',
              style: LineStyle.Dashed,
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

        this.chart.subscribeCrosshairMove((param) => {
          if (!param.time || !param.point) {
            const latest = candles[candles.length - 1];
            if (latest) {
              this.hoveredBar.set({
                timeStr: this.formatBarDateTime(latest.datetime || latest.timestamp),
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
            let vol: number | null = null;
            if (this.volumeSeries && param.seriesData.has(this.volumeSeries)) {
              const vData: any = param.seriesData.get(this.volumeSeries);
              vol = vData?.value ?? null;
            }

            this.hoveredBar.set({
              timeStr: this.formatBarDateTime(param.time),
              open: bar.open ?? bar.value ?? 0,
              high: bar.high ?? bar.value ?? 0,
              low: bar.low ?? bar.value ?? 0,
              close: bar.close ?? bar.value ?? 0,
              volume: vol
            });
          }
        });

        if (typeof ResizeObserver !== 'undefined') {
          this.resizeObserver = new ResizeObserver((entries) => {
            if (entries.length === 0 || !this.chart) return;
            const { width, height } = entries[0].contentRect;
            if (width > 0 && height > 0) {
              this.chart.applyOptions({ width, height });
            }
          });
          this.resizeObserver.observe(container);
        }
      }

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
          timeStr: this.formatBarDateTime(latest.datetime || latest.timestamp),
          open: latest.open,
          high: latest.high,
          low: latest.low,
          close: latest.close,
          volume: latest.volume
        });
      }

      this.chart.timeScale().fitContent();
      this.updateChartPriceLines(this.activeSymbolPositions());
    } catch (e) {
      // Headless or canvas error catch
    }
  }

  private updateChartPriceLines(positions: any[]): void {
    const activeSeries = this.candlestickSeries || this.lineSeries || this.areaSeries;
    if (!activeSeries) return;

    try {
      // Remove old price lines
      for (const pl of this.chartPriceLines) {
        try {
          activeSeries.removePriceLine(pl);
        } catch {}
      }
      this.chartPriceLines = [];

      // Add price lines for active positions
      for (const pos of positions) {
        if (!pos || pos.status !== 'OPEN') continue;

        const isLong = pos.side === 'LONG';
        const pnlStr = (pos.unrealizedPnl || 0) >= 0 ? `+$${(pos.unrealizedPnl || 0).toFixed(2)}` : `-$${Math.abs(pos.unrealizedPnl || 0).toFixed(2)}`;
        const label = `${pos.side} ${pos.quantity} @ ${pos.entryPrice.toFixed(2)} | P&L: ${pnlStr} (1:${pos.leverage}x)`;

        // Entry Price Line
        const entryLine = activeSeries.createPriceLine({
          price: pos.entryPrice,
          color: isLong ? '#10b981' : '#f43f5e',
          lineWidth: 2,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: true,
          title: label
        });
        this.chartPriceLines.push(entryLine);

        // Stop Loss Line
        if (pos.stopLoss && pos.stopLoss > 0) {
          const slLine = activeSeries.createPriceLine({
            price: pos.stopLoss,
            color: '#ef4444',
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: `SL @ ${pos.stopLoss.toFixed(2)}`
          });
          this.chartPriceLines.push(slLine);
        }

        // Take Profit Line
        if (pos.takeProfit && pos.takeProfit > 0) {
          const tpLine = activeSeries.createPriceLine({
            price: pos.takeProfit,
            color: '#10b981',
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: `TP @ ${pos.takeProfit.toFixed(2)}`
          });
          this.chartPriceLines.push(tpLine);
        }
      }
    } catch {}
  }

  // =========================================================================
  // SIMULATED TRADING ACTIONS
  // =========================================================================

  setTradeSide(side: PositionSide): void {
    this.tradeSide.set(side);
    this.tradeErrorMessage.set(null);
    this.tradeSuccessReceipt.set(null);
  }

  setTradingMode(mode: TradingMode): void {
    this.selectedTradingMode.set(mode);
    if (mode === 'SCALPING') {
      this.currentInterval.set('1min');
      this.fetchCandlesByInterval(this.symbol(), '1min', 100);
    } else if (mode === 'INTRADAY') {
      this.currentInterval.set('5min');
      this.fetchCandlesByInterval(this.symbol(), '5min', 100);
    }
  }

  setLeverage(lev: number): void {
    this.selectedLeverage.set(lev);
  }

  setTradeQuantity(qty: number): void {
    const val = Math.max(0.0001, Number(qty) || 1);
    this.tradeQuantity.set(val);
  }

  adjustQuantity(delta: number): void {
    const cur = this.tradeQuantity() || 1;
    const nextVal = Math.max(0.0001, Number((cur + delta).toFixed(4)));
    this.tradeQuantity.set(nextVal);
  }

  setQuickLot(lot: number): void {
    this.tradeQuantity.set(lot);
  }

  setMaxQuantity(): void {
    const currentPrice = this.currentQuote()?.price;
    if (!currentPrice || currentPrice <= 0) return;

    const balance = this.userWallet()?.cashBalance ?? 0;
    const leverage = this.effectiveLeverage();
    const maxAffordable = (balance * leverage) / currentPrice;
    this.tradeQuantity.set(Number(Math.max(0.01, maxAffordable).toFixed(2)));
  }

  setQuickSlPercent(percent: number): void {
    const curP = this.currentQuote()?.price;
    if (!curP) return;

    if (this.tradeSide() === 'LONG') {
      const sl = curP * (1 - percent / 100);
      this.stopLossPrice.set(Number(sl.toFixed(2)));
    } else {
      const sl = curP * (1 + percent / 100);
      this.stopLossPrice.set(Number(sl.toFixed(2)));
    }
  }

  setQuickTpPercent(percent: number): void {
    const curP = this.currentQuote()?.price;
    if (!curP) return;

    if (this.tradeSide() === 'LONG') {
      const tp = curP * (1 + percent / 100);
      this.takeProfitPrice.set(Number(tp.toFixed(2)));
    } else {
      const tp = curP * (1 - percent / 100);
      this.takeProfitPrice.set(Number(tp.toFixed(2)));
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
    const mode = this.selectedTradingMode();
    const side = this.tradeSide();
    const leverage = this.effectiveLeverage();
    const sl = this.stopLossPrice() || undefined;
    const tp = this.takeProfitPrice() || undefined;

    this.isSubmittingTrade.set(true);
    this.tradeErrorMessage.set(null);
    this.tradeSuccessReceipt.set(null);

    const action$ = side === 'LONG'
      ? this.tradingService.buy({
          symbol: sym,
          quantity: qty,
          tradingMode: mode,
          side: 'LONG',
          leverage: leverage,
          stopLoss: sl,
          takeProfit: tp
        })
      : this.tradingService.sell({
          symbol: sym,
          quantity: qty,
          tradingMode: mode,
          side: 'SHORT',
          leverage: leverage,
          stopLoss: sl,
          takeProfit: tp
        });

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

  closePosition(pos: PositionItem, quantity?: number): void {
    if (!pos || !pos.id) return;

    const qtyToClose = quantity != null && quantity > 0 ? quantity : undefined;
    this.isClosingPositionId.set(pos.id);
    this.tradingService.closePosition(pos.id, qtyToClose).subscribe({
      next: () => {
        this.isClosingPositionId.set(null);
        this.refreshTradingState();
      },
      error: (err) => {
        this.isClosingPositionId.set(null);
        this.tradeErrorMessage.set(err.error?.message || err.message || 'Failed to close position');
      }
    });
  }

  openCloseConfirmModal(pos: PositionItem, defaultQty?: number): void {
    this.closingPositionTarget.set(pos);
    const initialQty = defaultQty != null && defaultQty > 0 ? Math.min(defaultQty, pos.quantity) : pos.quantity;
    this.closeQuantity.set(initialQty);
    this.isCloseConfirmModalOpen.set(true);
  }

  closeCloseConfirmModal(): void {
    this.isCloseConfirmModalOpen.set(false);
    this.closingPositionTarget.set(null);
  }

  setClosePercent(percent: number): void {
    const pos = this.closingPositionTarget();
    if (!pos || !pos.quantity) return;
    const qty = Number(((pos.quantity * percent) / 100).toFixed(4));
    this.closeQuantity.set(Math.max(0.0001, qty));
  }

  setCloseQuantity(qty: number): void {
    const pos = this.closingPositionTarget();
    const maxQty = pos?.quantity || 999999;
    const val = Math.max(0.0001, Math.min(Number(qty) || 0.01, maxQty));
    this.closeQuantity.set(val);
  }

  adjustCloseQuantity(delta: number): void {
    const cur = this.closeQuantity() || 0.1;
    const pos = this.closingPositionTarget();
    const maxQty = pos?.quantity || 999999;
    const nextVal = Math.max(0.0001, Math.min(Number((cur + delta).toFixed(4)), maxQty));
    this.closeQuantity.set(nextVal);
  }

  confirmClosePosition(): void {
    const pos = this.closingPositionTarget();
    if (!pos || !pos.id) return;
    const qty = this.closeQuantity();
    this.closeCloseConfirmModal();
    this.closePosition(pos, qty);
  }

  prepareOpenLong(): void {
    this.tradeSide.set('LONG');
    this.tradeErrorMessage.set(null);
  }

  prepareOpenShort(): void {
    this.tradeSide.set('SHORT');
    this.tradeErrorMessage.set(null);
  }

  openModifyModal(pos: PositionItem): void {
    this.modifyingPosition.set(pos);
    this.modifyStopLoss.set(pos.stopLoss || null);
    this.modifyTakeProfit.set(pos.takeProfit || null);
    this.modifyErrorMessage.set(null);
    this.modifySuccessMessage.set(null);
    this.isModifyModalOpen.set(true);
  }

  closeModifyModal(): void {
    this.isModifyModalOpen.set(false);
    this.modifyingPosition.set(null);
    this.modifyErrorMessage.set(null);
    this.modifySuccessMessage.set(null);
  }

  setModifySlPercent(percent: number): void {
    const pos = this.modifyingPosition();
    const curP = this.currentQuote()?.price || pos?.entryPrice;
    if (!pos || !curP) return;

    if (pos.side === 'LONG') {
      const sl = curP * (1 - percent / 100);
      this.modifyStopLoss.set(Number(sl.toFixed(2)));
    } else {
      const sl = curP * (1 + percent / 100);
      this.modifyStopLoss.set(Number(sl.toFixed(2)));
    }
  }

  setModifyTpPercent(percent: number): void {
    const pos = this.modifyingPosition();
    const curP = this.currentQuote()?.price || pos?.entryPrice;
    if (!pos || !curP) return;

    if (pos.side === 'LONG') {
      const tp = curP * (1 + percent / 100);
      this.modifyTakeProfit.set(Number(tp.toFixed(2)));
    } else {
      const tp = curP * (1 - percent / 100);
      this.modifyTakeProfit.set(Number(tp.toFixed(2)));
    }
  }

  submitModifyPosition(): void {
    const pos = this.modifyingPosition();
    if (!pos || !pos.id) return;

    this.isSavingModify.set(true);
    this.modifyErrorMessage.set(null);
    this.modifySuccessMessage.set(null);

    const sl = this.modifyStopLoss() || undefined;
    const tp = this.modifyTakeProfit() || undefined;

    this.tradingService.updateSlTp(pos.id, sl, tp).subscribe({
      next: () => {
        this.isSavingModify.set(false);
        this.modifySuccessMessage.set('Position SL/TP updated successfully.');
        this.refreshTradingState();
        setTimeout(() => {
          this.closeModifyModal();
        }, 900);
      },
      error: (err) => {
        this.isSavingModify.set(false);
        this.modifyErrorMessage.set(err.error?.message || err.message || 'Failed to update position SL/TP');
      }
    });
  }

  dismissTradeSuccess(): void {
    this.tradeSuccessReceipt.set(null);
  }

  // =========================================================================
  // PRICE ALERT ACTIONS & STATE HANDLERS
  // =========================================================================

  openAlertModal(): void {
    const currentP = this.currentQuote()?.price ?? 100;
    this.alertTargetPrice.set(Number(currentP.toFixed(2)));
    this.alertCondition.set('ABOVE');
    this.alertNotes.set('');
    this.alertErrorMessage.set(null);
    this.alertSuccessMessage.set(null);
    this.isAlertModalOpen.set(true);
  }

  closeAlertModal(): void {
    this.isAlertModalOpen.set(false);
    this.alertErrorMessage.set(null);
    this.alertSuccessMessage.set(null);
  }

  setAlertCondition(cond: AlertConditionType): void {
    this.alertCondition.set(cond);
  }

  saveAlert(): void {
    if (!this.authService.isAuthenticated()) {
      this.alertErrorMessage.set('Please log in to create price alerts.');
      return;
    }

    const price = this.alertTargetPrice();
    if (!price || price <= 0) {
      this.alertErrorMessage.set('Please enter a valid target price greater than 0.');
      return;
    }

    this.isSavingAlert.set(true);
    this.alertErrorMessage.set(null);
    this.alertSuccessMessage.set(null);

    this.alertService.createAlert({
      symbol: this.symbol(),
      condition: this.alertCondition(),
      targetPrice: price,
      notes: this.alertNotes().trim() || undefined
    }).subscribe({
      next: () => {
        this.isSavingAlert.set(false);
        this.alertSuccessMessage.set(`Alert set: ${this.symbol()} ${this.alertCondition()} ${this.formatCurrencySymbol(this.symbol())}${price.toFixed(2)}`);
        setTimeout(() => {
          this.closeAlertModal();
        }, 1200);
      },
      error: (err) => {
        this.isSavingAlert.set(false);
        this.alertErrorMessage.set(err.error?.message || err.message || 'Failed to create price alert');
      }
    });
  }

  // =========================================================================
  // USER ACTIONS
  // =========================================================================

  setInterval(iv: StockDetailInterval): void {
    this.currentInterval.set(iv);
    const opt = this.intervals.find(i => i.value === iv);
    const outputsize = opt ? opt.outputsize : 100;
    this.fetchCandlesByInterval(this.symbol(), iv, outputsize);
  }

  setTimeframe(tf: TimeframeRange): void {
    this.currentTimeframe.set(tf);
    const { interval, outputsize } = this.getApiParamsForTimeframe(tf);
    this.currentInterval.set(interval as StockDetailInterval);
    this.fetchCandlesByInterval(this.symbol(), interval as StockDetailInterval, outputsize);
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
