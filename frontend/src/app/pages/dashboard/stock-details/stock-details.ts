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
import { timer, Subscription } from 'rxjs';
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
  HistogramData,
  SeriesMarker,
  createSeriesMarkers,
  ISeriesMarkersPluginApi
} from 'lightweight-charts';
import { MarketService } from '../../../services/market.service';
import { MarketWebSocketService, MarketTick } from '../../../services/market-websocket.service';
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
import { calculateSMA, calculateEMA } from '../../../utils/technical-analysis.utils';

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

export interface TopInstrumentItem {
  symbol: string;
  name: string;
  marketType: string;
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
  readonly marketWebSocketService = inject(MarketWebSocketService);
  readonly authService = inject(AuthService);
  readonly tradingService = inject(TradingService);
  readonly alertService = inject(AlertService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  // Chart Container DOM Reference
  readonly chartContainerRef = viewChild<ElementRef<HTMLDivElement>>('chartContainer');

  // Active Symbol & State
  readonly symbol = signal<string>('BTC/USD');
  readonly companyName = signal<string>('Bitcoin / US Dollar');
  readonly exchange = signal<string>('Crypto');
  readonly instrumentType = signal<string>('Crypto');
  readonly currentQuote = signal<StockQuote | null>(null);

  // Top Symbol Bar Instruments List
  readonly topInstruments = signal<TopInstrumentItem[]>([
    { symbol: 'BTC/USD', name: 'Bitcoin', marketType: 'Crypto' },
    { symbol: 'ETH/USD', name: 'Ethereum', marketType: 'Crypto' },
    { symbol: 'SOL/USD', name: 'Solana', marketType: 'Crypto' },
    { symbol: 'USOIL', name: 'WTI Crude Oil', marketType: 'Commodity' },
    { symbol: 'XAU/USD', name: 'Gold / USD', marketType: 'Commodity' },
    { symbol: 'AAPL', name: 'Apple Inc.', marketType: 'US Stock' },
    { symbol: 'NIFTY 50', name: 'Nifty 50 Index', marketType: 'Index' },
    { symbol: 'SENSEX', name: 'BSE Sensex', marketType: 'Index' },
    { symbol: 'EUR/USD', name: 'Euro / USD', marketType: 'Forex' }
  ]);

  // Symbol Search Modal State
  readonly isSearchModalOpen = signal<boolean>(false);
  readonly symbolSearchQuery = signal<string>('');
  readonly isSearchingSymbols = signal<boolean>(false);
  readonly searchResults = signal<any[]>([]);

  // Provider routing identification
  readonly currentProvider = computed(() => {
    return this.marketService.isIndianSymbol(this.symbol()) ? 'Upstox' : 'Twelve Data';
  });

  // Loading and Error states
  readonly isLoadingQuote = signal<boolean>(false);
  readonly isLoadingCandles = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  readonly isRateLimited = signal<boolean>(false);
  readonly isMarketDataUnavailable = signal<boolean>(false);

  // Real-time Live Market Feed & WebSocket Streaming States
  readonly isWebSocketConnected = signal<boolean>(false);
  readonly isReceivingRealTicks = signal<boolean>(false);
  readonly isStreamingUnavailable = signal<boolean>(false);
  readonly streamStatusMessage = signal<string | null>(null);
  readonly lastLiveTimestamp = signal<number>(Date.now());

  readonly isLiveConnected = computed(() => {
    return this.isWebSocketConnected() && this.isReceivingRealTicks() && !this.isStreamingUnavailable();
  });

  readonly hasTradableQuote = computed(() => {
    const q = this.currentQuote();
    return !!q && q.price != null && q.price > 0 && !this.isMarketDataUnavailable();
  });

  // Chart Controls State
  readonly currentChartType = signal<ChartType>('candles');
  readonly currentInterval = signal<StockDetailInterval>('5min');
  readonly currentTimeframe = signal<TimeframeRange>('1D');
  readonly isFullscreen = signal<boolean>(false);

  // Technical Indicators Toggles
  readonly activeIndicators = signal<{
    ema9: boolean;
    ema21: boolean;
    sma50: boolean;
    volume: boolean;
  }>({
    ema9: true,
    ema21: true,
    sma50: false,
    volume: true
  });

  // Live Hovered Candle / Bar Info
  readonly hoveredBar = signal<HoveredBarData | null>(null);

  // Real Candlestick Data Cache
  readonly candleData = signal<Candle[]>([]);

  // Timeframe / Interval Options Available (1m, 5m, 15m, 30m, 1H, 4H, 1D)
  readonly intervals: IntervalOption[] = [
    { label: '1m', value: '1min', outputsize: 100 },
    { label: '5m', value: '5min', outputsize: 100 },
    { label: '15m', value: '15min', outputsize: 100 },
    { label: '30m', value: '30min', outputsize: 100 },
    { label: '1H', value: '1h', outputsize: 120 },
    { label: '4H', value: '4h', outputsize: 120 },
    { label: '1D', value: '1day', outputsize: 180 }
  ];

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
  // EXNESS-INSPIRED ORDER PANEL & TRADING STATE
  // =========================================================================
  readonly tradeSide = signal<PositionSide>('LONG');
  readonly tradeQuantity = signal<number>(0.10);
  readonly selectedTradingMode = signal<TradingMode>('INTRADAY');
  readonly selectedLeverage = signal<number>(10);
  readonly orderType = signal<'MARKET' | 'PENDING'>('MARKET');
  readonly pendingPrice = signal<number | null>(null);
  readonly activeBottomTab = signal<'OPEN' | 'PENDING' | 'CLOSED'>('OPEN');
  readonly isTerminalCollapsed = signal<boolean>(false);
  readonly isTerminalExpanded = signal<boolean>(false);

  readonly stopLossPrice = signal<number | null>(null);
  readonly takeProfitPrice = signal<number | null>(null);
  readonly slInputMode = signal<'PRICE' | 'PERCENT'>('PRICE');
  readonly tpInputMode = signal<'PRICE' | 'PERCENT'>('PRICE');

  readonly isSubmittingTrade = signal<boolean>(false);
  readonly isClosingPositionId = signal<number | null>(null);
  readonly tradeSuccessReceipt = signal<TradeResponse | null>(null);
  readonly tradeErrorMessage = signal<string | null>(null);
  readonly tradeToast = signal<{ show: boolean; type: 'success' | 'error'; message: string; sub?: string } | null>(null);
  private toastTimeout: any = null;

  readonly userWallet = signal<VirtualWallet | null>(null);
  readonly userHolding = signal<UserHolding | null>(null);
  readonly userPositions = signal<PositionItem[]>([]);
  readonly closedPositions = signal<PositionItem[]>([]);

  readonly leverageOptions = [1, 2, 5, 10, 20, 50, 100];

  readonly spreadValue = computed(() => {
    const price = this.currentQuote()?.price ?? 0;
    if (price <= 0) return 0;
    const isCrypto = this.symbol().includes('/') || this.symbol().includes('BTC') || this.symbol().includes('ETH');
    const isForex = this.symbol().includes('EUR') || this.symbol().includes('USD') || this.symbol().includes('GBP');
    const pct = isCrypto ? 0.0002 : isForex ? 0.0001 : 0.0005;
    const spread = price * pct;
    return price > 100 ? Number(spread.toFixed(2)) : Number(spread.toFixed(4));
  });

  readonly bidPrice = computed(() => {
    const price = this.currentQuote()?.price ?? 0;
    const spread = this.spreadValue();
    return Math.max(0, price - (spread / 2));
  });

  readonly askPrice = computed(() => {
    const price = this.currentQuote()?.price ?? 0;
    const spread = this.spreadValue();
    return price + (spread / 2);
  });

  readonly tradingModesList: { mode: TradingMode; label: string; desc: string; badge: string; icon: string }[] = [
    { mode: 'SCALPING', label: 'Scalping', desc: '1m - 15m fast momentum execution', badge: '1m - 15m', icon: '⚡' },
    { mode: 'INTRADAY', label: 'Intraday', desc: 'Same-day leveraged session trading', badge: 'Same Day', icon: '⏱️' },
    { mode: 'SWING', label: 'Swing', desc: 'Multi-day spot trend trading', badge: 'Multi-Day', icon: '📈' },
    { mode: 'LONG_TERM', label: 'Long Term', desc: 'Long-term investment portfolio holding', badge: 'Long Hold', icon: '💎' }
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

  // Effective execution price (pending or market)
  readonly effectiveEntryPrice = computed(() => {
    if (this.orderType() === 'PENDING' && this.pendingPrice() && this.pendingPrice()! > 0) {
      return this.pendingPrice()!;
    }
    return this.currentQuote()?.price ?? 0;
  });

  // Position Value = Quantity * Price
  readonly positionValue = computed(() => {
    const price = this.effectiveEntryPrice();
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
    const curP = this.effectiveEntryPrice();
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
    const curP = this.effectiveEntryPrice();
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

  // REAL-TIME CONTINUOUS FLOATING P&L FOR ALL OPEN POSITIONS
  readonly liveOpenPositions = computed(() => {
    const curSym = this.symbol();
    const curP = this.currentQuote()?.price;

    return this.userPositions()
      .filter(p => p.status === 'OPEN')
      .map(p => {
        const livePrice = (p.symbol === curSym && curP && curP > 0) ? curP : (p.currentPrice || p.entryPrice);
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

  // Active open positions for currently selected symbol
  readonly activeSymbolPositions = computed(() => {
    const curSym = this.symbol();
    return this.liveOpenPositions().filter(p => p.symbol === curSym);
  });

  // Total floating P&L across all open positions
  readonly totalFloatingPnl = computed(() => {
    return this.liveOpenPositions().reduce((acc, p) => acc + (p.unrealizedPnl || 0), 0);
  });

  // Total floating P&L for currently selected symbol
  readonly totalSymbolFloatingPnl = computed(() => {
    return this.activeSymbolPositions().reduce((acc, p) => acc + (p.unrealizedPnl || 0), 0);
  });

  // Margin & Account Analytics
  readonly usedMargin = computed(() => {
    const fromWallet = this.userWallet()?.marginUsed;
    if (fromWallet != null && fromWallet > 0) return fromWallet;
    return this.liveOpenPositions().reduce((acc, p) => acc + (p.marginUsed || 0), 0);
  });

  readonly freeMargin = computed(() => {
    const fromWallet = this.userWallet()?.freeMargin;
    if (fromWallet != null && fromWallet > 0) return fromWallet;
    return this.userWallet()?.cashBalance ?? 0;
  });

  readonly totalEquity = computed(() => {
    const cash = this.userWallet()?.cashBalance ?? 0;
    const used = this.usedMargin();
    return cash + used + this.totalFloatingPnl();
  });

  readonly marginLevelPercent = computed(() => {
    const used = this.usedMargin();
    if (used <= 0) return 9999;
    return (this.totalEquity() / used) * 100;
  });

  // Live Terminal Session Clock
  readonly currentSessionTime = signal<string>('');
  private sessionClockTimer: any = null;

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
  // CLOSE POSITION MODAL STATE & PARTIAL CLOSE
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

  // Lightweight Charts Instances
  private chart: IChartApi | null = null;
  private candlestickSeries: ISeriesApi<'Candlestick'> | null = null;
  private lineSeries: ISeriesApi<'Line'> | null = null;
  private areaSeries: ISeriesApi<'Area'> | null = null;
  private volumeSeries: ISeriesApi<'Histogram'> | null = null;
  private ema9Series: ISeriesApi<'Line'> | null = null;
  private ema21Series: ISeriesApi<'Line'> | null = null;
  private sma50Series: ISeriesApi<'Line'> | null = null;
  private seriesMarkersPlugin: ISeriesMarkersPluginApi<Time> | null = null;
  private chartPriceLines: IPriceLine[] = [];
  private livePriceLine: IPriceLine | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private paramSub?: Subscription;
  private wsTickSub?: Subscription;
  private wsConnectedSub?: Subscription;
  private livePollingSub?: Subscription;
  private boundOnVisibilityChange?: () => void;

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

    // Effect to sync price lines and markers on chart when open positions change
    effect(() => {
      const positions = this.activeSymbolPositions();
      const quote = this.currentQuote();
      if (this.candlestickSeries || this.lineSeries || this.areaSeries) {
        this.updateChartPriceLines(positions);
        this.updateLivePriceLine(quote?.price ?? 0);
      }
    });
  }

  ngOnInit(): void {
    this.updateSessionClock();
    if (typeof window !== 'undefined') {
      this.sessionClockTimer = setInterval(() => this.updateSessionClock(), 1000);
    }

    // 1. Subscribe to real-time WebSocket ticks from Spring Boot Gateway
    this.wsTickSub = this.marketWebSocketService.ticks$.subscribe((tick) => {
      this.handleLiveTick(tick);
    });

    this.wsConnectedSub = this.marketWebSocketService.isConnected$.subscribe((connected) => {
      this.isWebSocketConnected.set(connected);
      if (!connected) {
        this.isReceivingRealTicks.set(false);
      }
    });

    // 2. Handle tab visibility change
    if (typeof document !== 'undefined') {
      this.boundOnVisibilityChange = () => {
        if (document.hidden) {
          if (this.livePollingSub) {
            this.livePollingSub.unsubscribe();
            this.livePollingSub = undefined;
          }
        } else {
          this.startPollingFallback(this.symbol());
        }
      };
      document.addEventListener('visibilitychange', this.boundOnVisibilityChange);
    }

    // 3. Handle route parameter changes
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
    this.stopLiveStream();
    this.paramSub?.unsubscribe();
    this.wsTickSub?.unsubscribe();
    this.wsConnectedSub?.unsubscribe();

    if (this.boundOnVisibilityChange && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.boundOnVisibilityChange);
    }

    if (this.sessionClockTimer) {
      clearInterval(this.sessionClockTimer);
      this.sessionClockTimer = null;
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.chart) {
      this.seriesMarkersPlugin = null;
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
  // INSTRUMENT SELECTION & SYMBOL SEARCH
  // =========================================================================

  selectSymbol(sym: string): void {
    const cleanSym = sym.trim().toUpperCase();
    if (!cleanSym || cleanSym === this.symbol()) return;

    // Check if symbol is in top bar; if not, add it
    const exists = this.topInstruments().some(i => i.symbol === cleanSym);
    if (!exists) {
      this.topInstruments.update(list => [
        { symbol: cleanSym, name: cleanSym, marketType: 'Custom' },
        ...list
      ]);
    }

    this.navigateToStock(cleanSym);
  }

  openSearchModal(): void {
    this.symbolSearchQuery.set('');
    this.searchResults.set([]);
    this.isSearchModalOpen.set(true);
  }

  closeSearchModal(): void {
    this.isSearchModalOpen.set(false);
  }

  onSearchQueryChange(query: string): void {
    this.symbolSearchQuery.set(query);
    const q = query.trim();
    if (!q) {
      this.searchResults.set([]);
      return;
    }

    this.isSearchingSymbols.set(true);
    this.marketService.searchSymbols(q).subscribe({
      next: (results) => {
        this.searchResults.set(results?.bestMatches || []);
        this.isSearchingSymbols.set(false);
      },
      error: () => {
        this.isSearchingSymbols.set(false);
      }
    });
  }

  selectSearchResult(item: any): void {
    const sym = item.symbol || item;
    this.closeSearchModal();
    this.selectSymbol(sym);
  }

  // =========================================================================
  // INSTRUMENT DATA LOADING & REAL-TIME STREAMING
  // =========================================================================

  loadInstrumentData(symbol: string): void {
    const cleanSym = symbol.trim().toUpperCase();
    if (!cleanSym) return;

    this.symbol.set(cleanSym);
    this.errorMessage.set(null);
    this.isRateLimited.set(false);
    this.isMarketDataUnavailable.set(false);
    this.tradeSuccessReceipt.set(null);
    this.tradeErrorMessage.set(null);
    this.stopLossPrice.set(null);
    this.takeProfitPrice.set(null);

    // Derive display metadata
    if (cleanSym.includes('NIFTY') || cleanSym.includes('SENSEX')) {
      this.instrumentType.set('Index');
      this.exchange.set(cleanSym.includes('SENSEX') ? 'BSE' : 'NSE');
      this.companyName.set(cleanSym.includes('SENSEX') ? 'BSE SENSEX Index' : 'NIFTY 50 Index');
    } else if (cleanSym === 'XAU/USD') {
      this.instrumentType.set('Commodity');
      this.exchange.set('Metals');
      this.companyName.set('Gold / US Dollar');
    } else if (cleanSym === 'USOIL') {
      this.instrumentType.set('Commodity');
      this.exchange.set('Energy');
      this.companyName.set('WTI Crude Oil');
    } else if (cleanSym.includes('/')) {
      this.instrumentType.set(cleanSym.startsWith('BTC') || cleanSym.startsWith('ETH') || cleanSym.startsWith('SOL') ? 'Crypto' : 'Forex');
      this.exchange.set(this.instrumentType() === 'Crypto' ? 'Binance' : 'Forex');
      this.companyName.set(cleanSym);
    } else if (this.marketService.isIndianSymbol(cleanSym)) {
      this.instrumentType.set('Stock');
      this.exchange.set('NSE');
      this.companyName.set(cleanSym);
    } else {
      this.instrumentType.set('Stock');
      this.exchange.set('NASDAQ');
      this.companyName.set(cleanSym);
    }

    // Fetch initial quote & candles
    this.fetchQuote(cleanSym);
    const opt = this.intervals.find(i => i.value === this.currentInterval());
    this.fetchCandlesByInterval(cleanSym, this.currentInterval(), opt ? opt.outputsize : 100);

    // Start WebSocket stream + fallback
    this.startLiveStream(cleanSym);

    if (this.authService.isAuthenticated()) {
      this.refreshTradingState();
    }
  }

  private startLiveStream(symbol: string): void {
    this.stopLiveStream();
    const cleanSym = symbol.trim().toUpperCase();
    if (!cleanSym) return;

    this.isReceivingRealTicks.set(false);
    this.isStreamingUnavailable.set(false);
    this.streamStatusMessage.set(null);

    this.marketWebSocketService.subscribe(cleanSym, this.currentInterval());
    this.startPollingFallback(cleanSym);
  }

  private startPollingFallback(symbol: string): void {
    if (this.livePollingSub) {
      this.livePollingSub.unsubscribe();
      this.livePollingSub = undefined;
    }

    this.livePollingSub = timer(3000, 3000).subscribe(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      const timeSinceLastTick = Date.now() - this.lastLiveTimestamp();
      if (timeSinceLastTick >= 2500) {
        this.pollFreshQuote(symbol);
      }
    });
  }

  private stopLiveStream(): void {
    const curSym = this.symbol();
    if (curSym) {
      this.marketWebSocketService.unsubscribe(curSym);
    }
    if (this.livePollingSub) {
      this.livePollingSub.unsubscribe();
      this.livePollingSub = undefined;
    }
  }

  private handleLiveTick(tick: MarketTick): void {
    if (!tick) return;
    const currentSym = this.symbol();

    if (tick.type === 'STATUS') {
      if (!tick.symbol || this.isMatchingSymbol(currentSym, tick.symbol, tick.instrumentKey)) {
        if (tick.status === 'DATA_UNAVAILABLE' || tick.streamingSupported === false) {
          this.isStreamingUnavailable.set(true);
          this.isReceivingRealTicks.set(false);
          this.streamStatusMessage.set(tick.message || 'Streaming unavailable');
        } else if (tick.status === 'CONNECTED') {
          this.isWebSocketConnected.set(true);
        }
      }
      return;
    }

    if (tick.type === 'PONG' || tick.price == null) return;

    if (tick.symbol && !this.isMatchingSymbol(currentSym, tick.symbol, tick.instrumentKey)) {
      return;
    }

    this.isReceivingRealTicks.set(true);
    this.isStreamingUnavailable.set(false);
    this.streamStatusMessage.set(null);
    this.isMarketDataUnavailable.set(false);
    this.lastLiveTimestamp.set(Date.now());

    if (this.errorMessage() === 'Live market data unavailable') {
      this.errorMessage.set(null);
    }

    const prev = this.currentQuote();
    const price = tick.price;
    const prevClose = prev?.previousClose || prev?.price || price;
    const change = tick.change != null ? tick.change : (price - prevClose);
    const changePercent = tick.changePercent || (prevClose > 0 ? `${change >= 0 ? '+' : ''}${((change / prevClose) * 100).toFixed(2)}%` : '+0.00%');

    const updatedQuote: StockQuote = {
      symbol: currentSym,
      name: prev?.name || this.companyName(),
      price: price,
      change: change,
      changePercent: changePercent,
      previousClose: prevClose,
      open: tick.open || prev?.open || price,
      high: tick.high ? Math.max(tick.high, prev?.high || price) : (prev ? Math.max(price, prev.high || price) : price),
      low: tick.low ? Math.min(tick.low, prev?.low || price) : (prev ? Math.min(price, prev.low || price) : price),
      volume: tick.volume != null ? tick.volume : prev?.volume || 0,
      latestTradingDay: new Date().toISOString().split('T')[0],
      timestamp: tick.timestamp ? Math.floor(tick.timestamp / 1000) : Math.floor(Date.now() / 1000)
    };

    this.currentQuote.set(updatedQuote);
    this.processLiveCandleTick(price, tick.volume, tick.timestamp);
  }

  private pollFreshQuote(symbol: string): void {
    this.marketService.getQuote(symbol, true).subscribe({
      next: (quote) => {
        if (quote && quote.price != null && quote.price > 0) {
          this.isMarketDataUnavailable.set(false);
          if (this.errorMessage() === 'Live market data unavailable') {
            this.errorMessage.set(null);
          }
          this.currentQuote.set(quote);
          if (quote.name && quote.name !== symbol) {
            this.companyName.set(quote.name);
          }
          this.processLiveCandleTick(quote.price, quote.volume, quote.timestamp ? quote.timestamp * 1000 : Date.now());
        }
      },
      error: () => {
        if (!this.currentQuote() || this.currentQuote()?.price == null) {
          this.isMarketDataUnavailable.set(true);
          this.errorMessage.set('Live market data unavailable');
        }
      }
    });
  }

  private processLiveCandleTick(livePrice: number, liveVolume?: number | null, tickTsMs?: number | null): void {
    const candles = this.candleData();
    if (!candles || candles.length === 0 || livePrice == null || livePrice <= 0) return;

    const intervalSec = this.getIntervalSeconds(this.currentInterval());
    const tickTsSec = tickTsMs ? Math.floor(tickTsMs / 1000) : Math.floor(Date.now() / 1000);
    const currentBucket = Math.floor(tickTsSec / intervalSec) * intervalSec;

    const lastIdx = candles.length - 1;
    const last = { ...candles[lastIdx] };
    const lastBucket = Math.floor(last.timestamp / intervalSec) * intervalSec;

    if (currentBucket > lastBucket) {
      const newCandle: Candle = {
        timestamp: currentBucket,
        datetime: new Date(currentBucket * 1000).toISOString(),
        open: livePrice,
        high: livePrice,
        low: livePrice,
        close: livePrice,
        volume: liveVolume || 0
      };

      const updatedCandles = [...candles, newCandle];
      this.candleData.set(updatedCandles);

      if (this.candlestickSeries) {
        try {
          this.candlestickSeries.update({
            time: (newCandle.timestamp as unknown) as Time,
            open: newCandle.open,
            high: newCandle.high,
            low: newCandle.low,
            close: newCandle.close
          });
        } catch (e) {}
      } else if (this.lineSeries) {
        try {
          this.lineSeries.update({
            time: (newCandle.timestamp as unknown) as Time,
            value: newCandle.close
          });
        } catch (e) {}
      } else if (this.areaSeries) {
        try {
          this.areaSeries.update({
            time: (newCandle.timestamp as unknown) as Time,
            value: newCandle.close
          });
        } catch (e) {}
      }
    } else {
      const updatedCandle: Candle = {
        ...last,
        high: Math.max(last.high, livePrice),
        low: Math.min(last.low, livePrice),
        close: livePrice,
        volume: (last.volume || 0) + (liveVolume || 0)
      };

      const updatedCandles = [...candles.slice(0, lastIdx), updatedCandle];
      this.candleData.set(updatedCandles);

      if (this.candlestickSeries) {
        try {
          this.candlestickSeries.update({
            time: (updatedCandle.timestamp as unknown) as Time,
            open: updatedCandle.open,
            high: updatedCandle.high,
            low: updatedCandle.low,
            close: updatedCandle.close
          });
        } catch (e) {}
      } else if (this.lineSeries) {
        try {
          this.lineSeries.update({
            time: (updatedCandle.timestamp as unknown) as Time,
            value: updatedCandle.close
          });
        } catch (e) {}
      } else if (this.areaSeries) {
        try {
          this.areaSeries.update({
            time: (updatedCandle.timestamp as unknown) as Time,
            value: updatedCandle.close
          });
        } catch (e) {}
      }
    }
  }

  private isMatchingSymbol(currentSymbol: string, tickSymbol?: string, instrumentKey?: string): boolean {
    if (!currentSymbol) return false;
    const c = currentSymbol.trim().toUpperCase();
    if (tickSymbol) {
      const t = tickSymbol.trim().toUpperCase();
      if (c === t || c.replace(/[\s\/\-_]+/g, '') === t.replace(/[\s\/\-_]+/g, '')) return true;
    }
    if (instrumentKey) {
      const ik = instrumentKey.toUpperCase();
      if (ik.includes(c) || ik.includes(c.replace(/[\s\/\-_]+/g, ''))) return true;
    }
    return false;
  }

  private getIntervalSeconds(interval: StockDetailInterval): number {
    switch (interval) {
      case '1min': return 60;
      case '5min': return 300;
      case '15min': return 900;
      case '30min': return 1800;
      case '1h': return 3600;
      case '4h': return 14400;
      case '1day': return 86400;
      case '1week': return 604800;
      default: return 300;
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
        this.isMarketDataUnavailable.set(false);
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

    this.tradingService.getPositions(undefined, 'CLOSED').subscribe({
      next: (closed) => this.closedPositions.set(closed || []),
      error: () => this.closedPositions.set([])
    });
  }

  readonly activeSymbolClosedPositions = computed(() => {
    const curSym = this.symbol();
    return this.closedPositions().filter(p => p.symbol === curSym);
  });

  private handleError(err: any, symbol: string): void {
    if (err.status === 429) {
      this.isRateLimited.set(true);
      this.errorMessage.set('Market data rate limit reached. Please try again shortly.');
    } else if (err.status === 404) {
      this.errorMessage.set('Data unavailable');
    } else if (err.status === 504) {
      this.errorMessage.set('Market data request timed out.');
    } else {
      this.errorMessage.set(err.error?.message || err.message || 'Data unavailable');
    }
  }

  // =========================================================================
  // LIGHTWEIGHT CHARTS RENDERING & OVERLAYS
  // =========================================================================

  formatBarDateTime(timeVal: any): string {
    if (!timeVal) return '';
    if (typeof timeVal === 'number') {
      const d = new Date(timeVal * 1000);
      const pad = (n: number) => n.toString().padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    }
    if (typeof timeVal === 'string') {
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
        const bgColor = isDark ? '#0b0e14' : '#ffffff';
        const textColor = isDark ? '#94a3b8' : '#475569';
        const gridColor = isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(226, 232, 240, 0.6)';
        const borderColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(226, 232, 240, 0.8)';

        this.chart = createChart(container, {
          width: container.clientWidth || 800,
          height: container.clientHeight || 500,
          layout: {
            background: { type: ColorType.Solid, color: bgColor },
            textColor: textColor,
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
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
              top: 0.06,
              bottom: 0.18
            }
          },
          timeScale: {
            borderColor: borderColor,
            timeVisible: true,
            secondsVisible: false,
            rightOffset: 12,
            barSpacing: 10
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
        color: c.close >= c.open ? 'rgba(16, 185, 129, 0.4)' : 'rgba(244, 63, 94, 0.4)'
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
      if (this.ema9Series) {
        this.chart.removeSeries(this.ema9Series);
        this.ema9Series = null;
      }
      if (this.ema21Series) {
        this.chart.removeSeries(this.ema21Series);
        this.ema21Series = null;
      }
      if (this.sma50Series) {
        this.chart.removeSeries(this.sma50Series);
        this.sma50Series = null;
      }

      // Add Volume Series
      if (this.activeIndicators().volume) {
        this.volumeSeries = this.chart.addSeries(HistogramSeries, {
          priceFormat: { type: 'volume' },
          priceScaleId: ''
        });
        this.volumeSeries.priceScale().applyOptions({
          scaleMargins: { top: 0.82, bottom: 0 }
        });
        this.volumeSeries.setData(volumeData);
      }

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

      // Add Indicator Overlay Series
      if (this.activeIndicators().ema9) {
        const ema9Result = calculateEMA(candles, 9);
        if (ema9Result.isSufficient) {
          this.ema9Series = this.chart.addSeries(LineSeries, {
            color: '#06b6d4',
            lineWidth: 1,
            title: 'EMA 9'
          });
          this.ema9Series.setData(ema9Result.data.map(d => ({ time: (d.time as unknown) as Time, value: d.value })));
        }
      }

      if (this.activeIndicators().ema21) {
        const ema21Result = calculateEMA(candles, 21);
        if (ema21Result.isSufficient) {
          this.ema21Series = this.chart.addSeries(LineSeries, {
            color: '#ec4899',
            lineWidth: 1,
            title: 'EMA 21'
          });
          this.ema21Series.setData(ema21Result.data.map(d => ({ time: (d.time as unknown) as Time, value: d.value })));
        }
      }

      if (this.activeIndicators().sma50) {
        const sma50Result = calculateSMA(candles, 50);
        if (sma50Result.isSufficient) {
          this.sma50Series = this.chart.addSeries(LineSeries, {
            color: '#eab308',
            lineWidth: 1,
            title: 'SMA 50'
          });
          this.sma50Series.setData(sma50Result.data.map(d => ({ time: (d.time as unknown) as Time, value: d.value })));
        }
      }

      this.chart.timeScale().fitContent();
      this.updateChartPriceLines(this.activeSymbolPositions());
      this.updateLivePriceLine(this.currentQuote()?.price ?? 0);
    } catch (e) {}
  }

  toggleIndicator(name: 'ema9' | 'ema21' | 'sma50' | 'volume'): void {
    this.activeIndicators.update(prev => ({
      ...prev,
      [name]: !prev[name]
    }));
    const container = this.chartContainerRef()?.nativeElement;
    const data = this.candleData();
    if (container && data.length > 0) {
      this.initOrUpdateChart(container, data, this.currentChartType());
    }
  }

  private updateLivePriceLine(price: number): void {
    const activeSeries = this.candlestickSeries || this.lineSeries || this.areaSeries;
    if (!activeSeries || !price || price <= 0) return;

    try {
      if (this.livePriceLine) {
        activeSeries.removePriceLine(this.livePriceLine);
        this.livePriceLine = null;
      }
      this.livePriceLine = activeSeries.createPriceLine({
        price: price,
        color: '#38bdf8',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: 'LIVE'
      });
    } catch {}
  }

  private updateChartPriceLines(positions: any[]): void {
    const activeSeries = this.candlestickSeries || this.lineSeries || this.areaSeries;
    if (!activeSeries) return;

    try {
      for (const pl of this.chartPriceLines) {
        try {
          activeSeries.removePriceLine(pl);
        } catch {}
      }
      this.chartPriceLines = [];

      const markers: SeriesMarker<Time>[] = [];

      for (const pos of positions) {
        if (!pos || pos.status !== 'OPEN') continue;

        const isLong = pos.side === 'LONG';
        const pnl = pos.unrealizedPnl || 0;
        const pnlSign = pnl >= 0 ? '+' : '-';
        const pnlStr = `${pnlSign}$${Math.abs(pnl).toFixed(2)} (${pos.unrealizedPnlPercent >= 0 ? '+' : ''}${(pos.unrealizedPnlPercent || 0).toFixed(2)}%)`;
        const label = `${pos.side} ${pos.quantity}L @ ${pos.entryPrice.toFixed(2)} | ${pnlStr}`;

        // Entry Line
        const entryLine = activeSeries.createPriceLine({
          price: pos.entryPrice,
          color: isLong ? '#10b981' : '#f43f5e',
          lineWidth: 2,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: true,
          title: label
        });
        this.chartPriceLines.push(entryLine);

        // SL Line
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

        // TP Line
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

        // Position Marker
        if (pos.createdAt && this.candleData().length > 0) {
          const tsSec = Math.floor(new Date(pos.createdAt).getTime() / 1000);
          const candles = this.candleData();
          // Find closest candle time
          const matchCandle = candles.find(c => Math.abs(c.timestamp - tsSec) < 1800) || candles[candles.length - 1];
          if (matchCandle) {
            markers.push({
              time: (matchCandle.timestamp as unknown) as Time,
              position: isLong ? 'belowBar' : 'aboveBar',
              color: isLong ? '#10b981' : '#f43f5e',
              shape: isLong ? 'arrowUp' : 'arrowDown',
              text: `${pos.side} ${pos.quantity}L @ ${pos.entryPrice.toFixed(2)}`
            });
          }
        }
      }

      if (this.candlestickSeries) {
        try {
          if (!this.seriesMarkersPlugin) {
            this.seriesMarkersPlugin = createSeriesMarkers(this.candlestickSeries, markers);
          } else {
            this.seriesMarkersPlugin.setMarkers(markers);
          }
        } catch {}
      }
    } catch {}
  }

  // =========================================================================
  // SIMULATED TRADING ACTIONS
  // =========================================================================

  setTradeSide(side: PositionSide): void {
    this.tradeSide.set(side);
    this.tradeErrorMessage.set(null);
  }

  setTradingMode(mode: TradingMode): void {
    this.selectedTradingMode.set(mode);
    if (mode === 'SCALPING') {
      this.setInterval('1min');
    } else if (mode === 'INTRADAY') {
      this.setInterval('5min');
    }
  }

  setLeverage(lev: number): void {
    this.selectedLeverage.set(lev);
  }

  setTradeQuantity(qty: number): void {
    const val = Math.max(0.0001, Number(qty) || 0.1);
    this.tradeQuantity.set(val);
  }

  adjustQuantity(delta: number): void {
    const cur = this.tradeQuantity() || 0.1;
    const nextVal = Math.max(0.0001, Number((cur + delta).toFixed(4)));
    this.tradeQuantity.set(nextVal);
  }

  setQuickLot(lot: number): void {
    this.tradeQuantity.set(lot);
  }

  setMaxQuantity(): void {
    const currentPrice = this.effectiveEntryPrice();
    if (!currentPrice || currentPrice <= 0) return;

    const balance = this.userWallet()?.cashBalance ?? 0;
    const leverage = this.effectiveLeverage();
    const maxAffordable = (balance * leverage) / currentPrice;
    this.tradeQuantity.set(Number(Math.max(0.01, maxAffordable).toFixed(2)));
  }

  setQuickSlPercent(percent: number): void {
    const curP = this.effectiveEntryPrice();
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
    const curP = this.effectiveEntryPrice();
    if (!curP) return;

    if (this.tradeSide() === 'LONG') {
      const tp = curP * (1 + percent / 100);
      this.takeProfitPrice.set(Number(tp.toFixed(2)));
    } else {
      const tp = curP * (1 - percent / 100);
      this.takeProfitPrice.set(Number(tp.toFixed(2)));
    }
  }

  showToast(type: 'success' | 'error', message: string, sub?: string): void {
    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }
    this.tradeToast.set({ show: true, type, message, sub });
    if (typeof window !== 'undefined') {
      this.toastTimeout = setTimeout(() => {
        this.tradeToast.set(null);
      }, 4500);
    }
  }

  dismissToast(): void {
    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }
    this.tradeToast.set(null);
  }

  setOrderType(type: 'MARKET' | 'PENDING'): void {
    this.orderType.set(type);
    if (type === 'PENDING' && !this.pendingPrice()) {
      this.pendingPrice.set(this.currentQuote()?.price || 100);
    }
  }

  setActiveBottomTab(tab: 'OPEN' | 'PENDING' | 'CLOSED'): void {
    this.activeBottomTab.set(tab);
    if (this.isTerminalCollapsed()) {
      this.isTerminalCollapsed.set(false);
    }
  }

  toggleTerminalCollapse(): void {
    this.isTerminalCollapsed.update(v => !v);
  }

  toggleTerminalExpand(): void {
    this.isTerminalExpanded.update(v => !v);
  }

  submitTrade(): void {
    if (!this.authService.isAuthenticated()) {
      this.tradeErrorMessage.set('Please log in to execute simulated trades.');
      this.showToast('error', 'Authentication required', 'Please log in to trade');
      return;
    }

    const qty = this.tradeQuantity();
    if (!qty || qty <= 0) {
      this.tradeErrorMessage.set('Quantity must be greater than zero.');
      return;
    }

    if (!this.hasTradableQuote()) {
      this.tradeErrorMessage.set('Live market data unavailable');
      this.showToast('error', 'Market data unavailable', 'Live market data unavailable');
      return;
    }

    if (this.hasInsufficientMargin()) {
      const errMsg = `Insufficient virtual balance. Required: $${this.requiredMargin().toFixed(2)}, Available: $${this.freeMargin().toFixed(2)}`;
      this.tradeErrorMessage.set(errMsg);
      this.showToast('error', 'Insufficient margin', errMsg);
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
        this.showToast(
          'success',
          `✓ ${receipt.orderType === 'BUY' ? 'BUY / LONG' : 'SELL / SHORT'} executed successfully`,
          `${receipt.quantity} LOT on ${receipt.symbol} at ${this.formatCurrencySymbol(receipt.symbol)}${receipt.executionPrice != null ? receipt.executionPrice.toFixed(2) : ''}`
        );
        this.refreshTradingState();
      },
      error: (err) => {
        this.isSubmittingTrade.set(false);
        const errMsg = err.error?.message || err.message || 'Trade execution failed';
        this.tradeErrorMessage.set(errMsg);
        this.showToast('error', 'Trade rejected', errMsg);
      }
    });
  }

  closePosition(pos: PositionItem, quantity?: number): void {
    if (!pos || !pos.id) return;

    if (!this.hasTradableQuote()) {
      this.tradeErrorMessage.set('Live market data unavailable');
      this.showToast('error', 'Market data unavailable', 'Live market data unavailable');
      return;
    }

    const qtyToClose = quantity != null && quantity > 0 ? quantity : undefined;
    this.isClosingPositionId.set(pos.id);
    this.tradingService.closePosition(pos.id, qtyToClose).subscribe({
      next: (closedPos) => {
        this.isClosingPositionId.set(null);
        this.showToast(
          'success',
          `✓ Position closed successfully`,
          `${qtyToClose || pos.quantity} LOT on ${pos.symbol} at ${this.formatCurrencySymbol(pos.symbol)}${closedPos.closePrice != null ? closedPos.closePrice.toFixed(2) : ''}`
        );
        this.refreshTradingState();
      },
      error: (err) => {
        this.isClosingPositionId.set(null);
        const errMsg = err.error?.message || err.message || 'Failed to close position';
        this.tradeErrorMessage.set(errMsg);
        this.showToast('error', 'Close failed', errMsg);
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

  // =========================================================================
  // PRICE ALERT ACTIONS
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
    this.marketWebSocketService.subscribe(this.symbol(), iv);
  }

  setTimeframe(tf: TimeframeRange): void {
    this.currentTimeframe.set(tf);
    let interval: StockDetailInterval = '5min';
    let outputsize = 100;
    switch (tf) {
      case '1D': interval = '5min'; outputsize = 78; break;
      case '1W': interval = '15min'; outputsize = 130; break;
      case '1M': interval = '1h'; outputsize = 160; break;
      case '3M': interval = '1day'; outputsize = 90; break;
      case '6M': interval = '1day'; outputsize = 180; break;
      case '1Y': interval = '1day'; outputsize = 365; break;
    }
    this.currentInterval.set(interval);
    this.fetchCandlesByInterval(this.symbol(), interval, outputsize);
    this.marketWebSocketService.subscribe(this.symbol(), interval);
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
}
