import {
  Component,
  inject,
  OnInit,
  signal,
  computed,
  OnDestroy,
  ElementRef,
  viewChild,
  effect,
  HostListener
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subject, Subscription, of, timer } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, catchError } from 'rxjs/operators';
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
import { StockQuote, StockSearchItem, Candle, CandleSeries } from '../../../models/market.model';
import {
  IndicatorCategory,
  IndicatorDefinition,
  ActiveIndicator,
  INDICATOR_LIBRARY,
  INDICATOR_CATEGORIES
} from '../../../models/indicator.model';
import {
  calculateIndicatorSeries,
  IndicatorRenderSeries
} from '../../../utils/indicator-calc';
import { DrawingTool, ChartDrawing, DrawingPoint } from '../../../models/drawing.model';

export type MarketCategory = 'all' | 'indices' | 'stocks' | 'forex' | 'crypto';
export type ChartType = 'candles' | 'line' | 'area';
export type ChartInterval = '1min' | '5min' | '15min' | '30min' | '1h' | '4h' | '1day';
export type TimeframeRange = '1D' | '5D' | '1M' | '3M' | '6M' | '1Y' | '5Y' | 'ALL';

export interface WatchlistItem {
  symbol: string;
  name: string;
  category: 'indices' | 'stocks' | 'forex' | 'crypto';
  price?: number | null;
  change?: number | null;
  changePercent?: string | null;
  exchange?: string | null;
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
  selector: 'app-market',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './market.html',
  styleUrl: './market.css'
})
export class MarketComponent implements OnInit, OnDestroy {
  private readonly marketService = inject(MarketService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  // Chart & Drawing Canvas DOM References
  readonly chartContainerRef = viewChild<ElementRef<HTMLDivElement>>('chartContainer');
  readonly drawingCanvasRef = viewChild<ElementRef<HTMLCanvasElement>>('drawingCanvas');

  // Active Category Tab
  readonly activeCategory = signal<MarketCategory>('all');

  // Search State
  readonly searchQuery = signal<string>('');
  readonly isSearching = signal<boolean>(false);
  readonly searchResults = signal<StockSearchItem[]>([]);
  readonly showDropdown = signal<boolean>(false);

  // Selected Instrument State
  readonly selectedSymbol = signal<string>('AAPL');
  readonly selectedCompanyName = signal<string>('Apple Inc.');
  readonly selectedExchange = signal<string>('NASDAQ');
  readonly selectedType = signal<string>('Stocks');
  readonly currentQuote = signal<StockQuote | null>(null);

  readonly currentProvider = computed(() => {
    return this.marketService.isIndianSymbol(this.selectedSymbol()) ? 'Upstox' : 'Twelve Data';
  });

  // Loading and Error states
  readonly isLoadingQuote = signal<boolean>(false);
  readonly isLoadingCandles = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  readonly isRateLimited = signal<boolean>(false);

  // Chart Controls State
  readonly currentChartType = signal<ChartType>('candles');
  readonly currentInterval = signal<ChartInterval>('5min');
  readonly currentTimeframe = signal<TimeframeRange>('1D');
  readonly isFullscreen = signal<boolean>(false);

  // Live Hovered Candle / Bar Info
  readonly hoveredBar = signal<HoveredBarData | null>(null);

  // Live Streaming / Polling Status
  readonly isLiveConnected = signal<boolean>(true);
  readonly lastLiveTimestamp = signal<number>(Date.now());
  private livePollingSub?: Subscription;

  // Watchlist Local Search / Filter & Section Collapsing
  readonly watchlistSearch = signal<string>('');
  readonly isIndicesCollapsed = signal<boolean>(false);
  readonly isStocksCollapsed = signal<boolean>(false);
  readonly isForexCollapsed = signal<boolean>(false);
  readonly isCryptoCollapsed = signal<boolean>(false);

  // Resizable Watchlist Pane
  readonly watchlistWidth = signal<number>(330);
  readonly isResizingWatchlist = signal<boolean>(false);
  private resizeStartX = 0;
  private resizeStartWidth = 330;
  private boundOnMouseMove?: (e: MouseEvent) => void;
  private boundOnMouseUp?: (e: MouseEvent) => void;
  private boundOnVisibilityChange?: () => void;

  // Real Candlestick Data Cache
  readonly candleData = signal<Candle[]>([]);

  // ==========================================
  // DRAWING TOOLS & STATE
  // ==========================================
  readonly selectedDrawingTool = signal<DrawingTool>('cursor');
  readonly isMagnetMode = signal<boolean>(false);
  readonly isDrawingsLocked = signal<boolean>(false);
  readonly isDrawingsHidden = signal<boolean>(false);
  readonly activeDrawingColor = signal<string>('#38bdf8');
  readonly activeLineWidth = signal<number>(2);

  readonly drawings = signal<ChartDrawing[]>([]);
  readonly selectedDrawingId = signal<string | null>(null);

  // In-progress drawing draft
  private currentDraftDrawing: ChartDrawing | null = null;
  private isDrawingMouseDown = false;

  // ==========================================
  // INDICATOR LIBRARY & ACTIVE STATE
  // ==========================================
  readonly indicatorCategories = INDICATOR_CATEGORIES;
  readonly isIndicatorModalOpen = signal<boolean>(false);
  readonly indicatorSearchQuery = signal<string>('');
  readonly selectedIndicatorCategory = signal<string>('all');
  readonly indicatorLibrary = signal<IndicatorDefinition[]>(INDICATOR_LIBRARY);
  readonly activeIndicators = signal<ActiveIndicator[]>([]);

  // Editing Settings Modal State
  readonly editingIndicator = signal<ActiveIndicator | null>(null);
  readonly editingParams = signal<Record<string, any>>({});
  readonly editingColor = signal<string>('#3b82f6');
  readonly editingLineWidth = signal<number>(2);

  // Filtered Indicators in Library Modal
  readonly filteredIndicators = computed(() => {
    const query = this.indicatorSearchQuery().trim().toLowerCase();
    const cat = this.selectedIndicatorCategory();

    return this.indicatorLibrary().filter(ind => {
      const matchCat = cat === 'all' || ind.category === cat;
      const matchQuery =
        !query ||
        ind.name.toLowerCase().includes(query) ||
        ind.shortName.toLowerCase().includes(query) ||
        ind.description.toLowerCase().includes(query) ||
        ind.tags.some(t => t.toLowerCase().includes(query));
      return matchCat && matchQuery;
    });
  });

  getCategoryCount(catId: string): number {
    if (catId === 'all') return this.indicatorLibrary().length;
    return this.indicatorLibrary().filter(i => i.category === catId).length;
  }

  // Intervals Available
  readonly intervals: { label: string; value: ChartInterval }[] = [
    { label: '1m', value: '1min' },
    { label: '5m', value: '5min' },
    { label: '15m', value: '15min' },
    { label: '30m', value: '30min' },
    { label: '1H', value: '1h' },
    { label: '4H', value: '4h' },
    { label: '1D', value: '1day' }
  ];

  // Timeframe Ranges Available
  readonly timeframes: TimeframeRange[] = ['1D', '5D', '1M', '3M', '6M', '1Y', '5Y', 'ALL'];

  // Popular Market Quick Chips
  readonly popularShortcuts = [
    { symbol: 'NIFTY 50', name: 'Nifty 50 Index', category: 'indices' as const },
    { symbol: 'SENSEX', name: 'BSE Sensex Index', category: 'indices' as const },
    { symbol: 'RELIANCE', name: 'Reliance Industries Ltd', category: 'stocks' as const },
    { symbol: 'TCS', name: 'Tata Consultancy Services', category: 'stocks' as const },
    { symbol: 'AAPL', name: 'Apple Inc.', category: 'stocks' as const },
    { symbol: 'NVDA', name: 'Nvidia Corp.', category: 'stocks' as const },
    { symbol: 'EUR/USD', name: 'Euro / USD', category: 'forex' as const },
    { symbol: 'BTC/USD', name: 'Bitcoin / USD', category: 'crypto' as const }
  ];

  // Watchlist Catalog
  readonly watchlist = signal<WatchlistItem[]>([
    // Indian Indices (Upstox)
    { symbol: 'NIFTY 50', name: 'Nifty 50 Index', category: 'indices', exchange: 'NSE' },
    { symbol: 'SENSEX', name: 'BSE Sensex Index', category: 'indices', exchange: 'BSE' },
    { symbol: 'BANK NIFTY', name: 'Nifty Bank Index', category: 'indices', exchange: 'NSE' },
    { symbol: 'NIFTY IT', name: 'Nifty IT Index', category: 'indices', exchange: 'NSE' },
    { symbol: 'NIFTY AUTO', name: 'Nifty Auto Index', category: 'indices', exchange: 'NSE' },
    { symbol: 'NIFTY FIN SERVICE', name: 'Nifty Financial Services Index', category: 'indices', exchange: 'NSE' },

    // Indian Stocks (Upstox)
    { symbol: 'RELIANCE', name: 'Reliance Industries Ltd', category: 'stocks', exchange: 'NSE' },
    { symbol: 'TCS', name: 'Tata Consultancy Services', category: 'stocks', exchange: 'NSE' },
    { symbol: 'HDFCBANK', name: 'HDFC Bank Ltd', category: 'stocks', exchange: 'NSE' },
    { symbol: 'INFY', name: 'Infosys Ltd', category: 'stocks', exchange: 'NSE' },
    { symbol: 'ICICIBANK', name: 'ICICI Bank Ltd', category: 'stocks', exchange: 'NSE' },
    { symbol: 'SBIN', name: 'State Bank of India', category: 'stocks', exchange: 'NSE' },
    { symbol: 'TATAMOTORS', name: 'Tata Motors Ltd', category: 'stocks', exchange: 'NSE' },

    // US Stocks (Twelve Data)
    { symbol: 'AAPL', name: 'Apple Inc.', category: 'stocks', exchange: 'NASDAQ' },
    { symbol: 'MSFT', name: 'Microsoft Corp.', category: 'stocks', exchange: 'NASDAQ' },
    { symbol: 'GOOGL', name: 'Alphabet Inc.', category: 'stocks', exchange: 'NASDAQ' },
    { symbol: 'NVDA', name: 'NVIDIA Corp.', category: 'stocks', exchange: 'NASDAQ' },
    { symbol: 'TSLA', name: 'Tesla Inc.', category: 'stocks', exchange: 'NASDAQ' },
    { symbol: 'AMZN', name: 'Amazon.com Inc.', category: 'stocks', exchange: 'NASDAQ' },

    // Forex (Twelve Data)
    { symbol: 'EUR/USD', name: 'Euro / US Dollar', category: 'forex', exchange: 'Forex' },
    { symbol: 'GBP/USD', name: 'British Pound / USD', category: 'forex', exchange: 'Forex' },
    { symbol: 'USD/JPY', name: 'US Dollar / Yen', category: 'forex', exchange: 'Forex' },
    { symbol: 'AUD/USD', name: 'Australian Dollar / USD', category: 'forex', exchange: 'Forex' },

    // Crypto (Twelve Data)
    { symbol: 'BTC/USD', name: 'Bitcoin / US Dollar', category: 'crypto', exchange: 'Coinbase' },
    { symbol: 'ETH/USD', name: 'Ethereum / US Dollar', category: 'crypto', exchange: 'Coinbase' },
    { symbol: 'SOL/USD', name: 'Solana / US Dollar', category: 'crypto', exchange: 'Binance' }
  ]);

  // Watchlist Drag and Drop State
  readonly draggedItem = signal<{ symbol: string; category: string } | null>(null);
  readonly dragOverTarget = signal<string | null>(null);
  readonly dragOverPosition = signal<'above' | 'below' | null>(null);

  // Filtered Watchlist based on Category and Search
  readonly filteredWatchlist = computed(() => {
    const cat = this.activeCategory();
    const query = this.watchlistSearch().trim().toLowerCase();

    return this.watchlist().filter(item => {
      const matchCat = (cat === 'all') || (item.category === cat);
      const matchQuery = !query ||
        item.symbol.toLowerCase().includes(query) ||
        item.name.toLowerCase().includes(query);
      return matchCat && matchQuery;
    });
  });

  readonly indicesWatchlist = computed(() => this.filteredWatchlist().filter(w => w.category === 'indices'));
  readonly stockWatchlist = computed(() => this.filteredWatchlist().filter(w => w.category === 'stocks'));
  readonly forexWatchlist = computed(() => this.filteredWatchlist().filter(w => w.category === 'forex'));
  readonly cryptoWatchlist = computed(() => this.filteredWatchlist().filter(w => w.category === 'crypto'));

  readonly indicesCount = computed(() => this.watchlist().filter(w => w.category === 'indices').length);
  readonly stockCount = computed(() => this.watchlist().filter(w => w.category === 'stocks').length);
  readonly forexCount = computed(() => this.watchlist().filter(w => w.category === 'forex').length);
  readonly cryptoCount = computed(() => this.watchlist().filter(w => w.category === 'crypto').length);

  // Lightweight Charts Instances
  private chart: IChartApi | null = null;
  private candlestickSeries: ISeriesApi<'Candlestick'> | null = null;
  private lineSeries: ISeriesApi<'Line'> | null = null;
  private areaSeries: ISeriesApi<'Area'> | null = null;
  private volumeSeries: ISeriesApi<'Histogram'> | null = null;
  private indicatorSeriesMap = new Map<string, ISeriesApi<any>>();
  private resizeObserver: ResizeObserver | null = null;

  private readonly searchSubject = new Subject<string>();
  private searchSubscription?: Subscription;
  private queryParamSub?: Subscription;

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

    // Effect to re-render indicators when activeIndicators change
    effect(() => {
      this.activeIndicators();
      const data = this.candleData();
      if (this.chart && data && data.length > 0) {
        this.renderAllIndicators();
      }
    });

    // Effect to trigger drawing render when drawings or hidden states change
    effect(() => {
      this.drawings();
      this.isDrawingsHidden();
      this.selectedDrawingId();
      this.renderDrawings();
    });
  }

  ngOnInit(): void {
    // Setup debounced search for keyword suggestions
    this.searchSubscription = this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap((keywords) => {
        if (!keywords || keywords.trim().length < 2) {
          this.isSearching.set(false);
          this.searchResults.set([]);
          this.showDropdown.set(false);
          return of({ bestMatches: [], query: keywords });
        }
        this.isSearching.set(true);
        return this.marketService.searchSymbols(keywords).pipe(
          catchError(() => {
            this.isSearching.set(false);
            return of({ bestMatches: [], query: keywords });
          })
        );
      })
    ).subscribe({
      next: (res) => {
        this.isSearching.set(false);
        if (res && res.bestMatches && res.bestMatches.length > 0) {
          this.searchResults.set(res.bestMatches);
          this.showDropdown.set(true);
        } else {
          this.searchResults.set([]);
          this.showDropdown.set(false);
        }
      }
    });

    // Load saved watchlist state & drawings
    this.loadSavedWatchlistState();
    this.loadDrawingsForSymbol(this.selectedSymbol());

    // Handle query params e.g. /dashboard/market?symbol=BTC/USD
    this.queryParamSub = this.route.queryParams.subscribe((params) => {
      const symbolParam = params['symbol'] || params['q'];
      if (symbolParam) {
        this.loadInstrument(symbolParam);
      } else {
        this.loadInstrument(this.selectedSymbol());
      }
    });

    // Background watchlist live price refresh
    this.refreshWatchlistQuotes();

    // Start live candle updates loop
    this.startLiveCandleStream();

    // Listen for tab visibility changes to save background API limits
    if (typeof document !== 'undefined') {
      this.boundOnVisibilityChange = () => {
        if (document.hidden) {
          this.stopLiveCandleStream();
        } else {
          this.startLiveCandleStream();
        }
      };
      document.addEventListener('visibilitychange', this.boundOnVisibilityChange);
    }
  }

  ngOnDestroy(): void {
    this.stopLiveCandleStream();
    this.searchSubscription?.unsubscribe();
    this.queryParamSub?.unsubscribe();
    if (this.boundOnMouseMove) {
      document.removeEventListener('mousemove', this.boundOnMouseMove);
    }
    if (this.boundOnMouseUp) {
      document.removeEventListener('mouseup', this.boundOnMouseUp);
    }
    if (this.boundOnVisibilityChange) {
      document.removeEventListener('visibilitychange', this.boundOnVisibilityChange);
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

  // =========================================================================
  // INSTRUMENT SELECTION & DATA FETCHING
  // =========================================================================

  loadInstrument(symbol: string, name?: string, exchange?: string, type?: string): void {
    const cleanSym = symbol.trim().toUpperCase();
    if (!cleanSym) return;

    this.selectedSymbol.set(cleanSym);
    if (name) this.selectedCompanyName.set(name);
    if (exchange) this.selectedExchange.set(exchange);
    if (type) this.selectedType.set(type);

    this.showDropdown.set(false);
    this.errorMessage.set(null);
    this.isRateLimited.set(false);

    // Load saved drawings for this symbol
    this.loadDrawingsForSymbol(cleanSym);

    // Fetch both Quote and Candles
    this.fetchQuote(cleanSym, name);
    this.fetchCandles(cleanSym, this.currentInterval());

    // Restart live candle polling stream for newly selected symbol
    this.startLiveCandleStream();
  }

  fetchQuote(symbol: string, companyName?: string): void {
    this.isLoadingQuote.set(true);

    this.marketService.getQuote(symbol).subscribe({
      next: (quote) => {
        this.isLoadingQuote.set(false);
        this.currentQuote.set(quote);
        if (quote.name) {
          this.selectedCompanyName.set(quote.name);
        }
        this.updateWatchlistItem(symbol, quote.price, quote.change, quote.changePercent);
      },
      error: (err) => {
        this.isLoadingQuote.set(false);
        this.handleError(err, symbol);
      }
    });
  }

  fetchCandles(symbol: string, interval: ChartInterval): void {
    this.isLoadingCandles.set(true);

    const size = this.getOutputSizeForTimeframe(this.currentTimeframe());

    this.marketService.getCandles(symbol, interval, size).subscribe({
      next: (series) => {
        this.isLoadingCandles.set(false);
        if (series && series.candles && series.candles.length > 0) {
          this.candleData.set(series.candles);
          if (series.exchange) this.selectedExchange.set(series.exchange);
          if (series.type) this.selectedType.set(series.type);
        } else {
          this.candleData.set([]);
          this.errorMessage.set('No chart data available for this instrument.');
        }
      },
      error: (err) => {
        this.isLoadingCandles.set(false);
        this.candleData.set([]);
        this.handleError(err, symbol);
      }
    });
  }

  private handleError(err: any, symbol: string): void {
    if (err.status === 429) {
      this.isRateLimited.set(true);
      this.errorMessage.set('Twelve Data API rate limit reached. Please try again shortly or configure an upgraded plan.');
    } else if (err.status === 404) {
      this.errorMessage.set(`No market data found for symbol "${symbol}". Please verify the symbol.`);
    } else if (err.status === 504) {
      this.errorMessage.set('Market data request timed out. Please check your connection and try again.');
    } else {
      this.errorMessage.set(err.error?.message || err.message || 'Market data temporarily unavailable. Please try again.');
    }
  }

  private getOutputSizeForTimeframe(tf: TimeframeRange): number {
    switch (tf) {
      case '1D':
        return 78;
      case '5D':
        return 120;
      case '1M':
        return 180;
      case '3M':
        return 240;
      case '6M':
        return 300;
      case '1Y':
      case '5Y':
      case 'ALL':
      default:
        return 365;
    }
  }

  // =========================================================================
  // REAL-TIME LIVE CANDLE UPDATES (REQUIREMENT 8)
  // =========================================================================

  private startLiveCandleStream(): void {
    this.stopLiveCandleStream();

    // Poll live price from Spring Boot backend every 3.5 seconds
    this.livePollingSub = timer(3500, 3500).pipe(
      switchMap(() => {
        const symbol = this.selectedSymbol();
        if (!symbol) return of(null);
        return this.marketService.getQuote(symbol).pipe(
          catchError(() => {
            this.isLiveConnected.set(false);
            return of(null);
          })
        );
      })
    ).subscribe({
      next: (quote) => {
        if (!quote || quote.price == null) return;

        this.isLiveConnected.set(true);
        this.lastLiveTimestamp.set(Date.now());
        this.currentQuote.set(quote);
        this.updateWatchlistItem(this.selectedSymbol(), quote.price, quote.change, quote.changePercent);

        // Update the current/latest candlestick in real-time
        this.updateCurrentCandleWithLivePrice(quote.price, quote.volume);
      }
    });
  }

  private stopLiveCandleStream(): void {
    if (this.livePollingSub) {
      this.livePollingSub.unsubscribe();
      this.livePollingSub = undefined;
    }
  }

  private updateCurrentCandleWithLivePrice(livePrice: number, liveVolume?: number | null): void {
    const candles = this.candleData();
    if (!candles || candles.length === 0) return;

    const lastIdx = candles.length - 1;
    const last = { ...candles[lastIdx] };

    // Dynamic movement: update high, low, close
    last.close = livePrice;
    if (livePrice > last.high) last.high = livePrice;
    if (livePrice < last.low) last.low = livePrice;
    if (liveVolume != null && liveVolume > 0) last.volume = liveVolume;

    // Mutate candle cache
    const updatedCandles = [...candles];
    updatedCandles[lastIdx] = last;
    this.candleData.set(updatedCandles);

    // Apply immediate update to Lightweight Charts series
    if (this.candlestickSeries) {
      try {
        this.candlestickSeries.update({
          time: (last.timestamp as unknown) as Time,
          open: last.open,
          high: last.high,
          low: last.low,
          close: last.close
        });
      } catch (e) {
        // ignore
      }
    } else if (this.lineSeries) {
      try {
        this.lineSeries.update({
          time: (last.timestamp as unknown) as Time,
          value: last.close
        });
      } catch (e) {
        // ignore
      }
    } else if (this.areaSeries) {
      try {
        this.areaSeries.update({
          time: (last.timestamp as unknown) as Time,
          value: last.close
        });
      } catch (e) {
        // ignore
      }
    }

    if (this.volumeSeries && last.volume != null) {
      try {
        this.volumeSeries.update({
          time: (last.timestamp as unknown) as Time,
          value: last.volume,
          color: last.close >= last.open ? 'rgba(16, 185, 129, 0.45)' : 'rgba(244, 63, 94, 0.45)'
        });
      } catch (e) {
        // ignore
      }
    }

    // Re-render drawings on canvas so measurements/rays remain synchronized
    this.renderDrawings();
  }

  // =========================================================================
  // LIGHTWEIGHT CHARTS INTEGRATION
  // =========================================================================

  private initOrUpdateChart(container: HTMLDivElement, candles: Candle[], chartType: ChartType): void {
    if (!candles || candles.length === 0 || typeof window === 'undefined') return;

    try {
      const isDark = !document.documentElement.getAttribute('data-theme')?.includes('light');

      const bgColor = 'transparent';
      const textColor = isDark ? '#a1a1aa' : '#64748b';
      const gridColor = isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(15, 23, 42, 0.05)';
      const borderColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.08)';

      if (!this.chart) {
        container.innerHTML = '';

        this.chart = createChart(container, {
          width: container.clientWidth || 800,
          height: container.clientHeight || 560,
          layout: {
            background: { type: ColorType.Solid, color: bgColor },
            textColor: textColor,
            fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
          },
          grid: {
            vertLines: { color: gridColor },
            horzLines: { color: gridColor }
          },
          crosshair: {
            mode: CrosshairMode.Normal,
            vertLine: {
              color: '#818cf8',
              width: 1,
              style: 3,
              visible: true,
              labelVisible: true,
              labelBackgroundColor: '#4f46e5'
            },
            horzLine: {
              color: '#818cf8',
              width: 1,
              style: 3,
              visible: true,
              labelVisible: true,
              labelBackgroundColor: '#4f46e5'
            }
          },
          handleScroll: {
            mouseWheel: true,
            pressedMouseMove: true,
            horzTouchDrag: true,
            vertTouchDrag: true
          },
          handleScale: {
            mouseWheel: true,
            pinch: true,
            axisPressedMouseMove: {
              time: true,
              price: true
            },
            axisDoubleClickReset: {
              time: true,
              price: true
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

        // Re-render drawings on time scale changes (pan/zoom)
        this.chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
          this.renderDrawings();
        });
        this.chart.timeScale().subscribeVisibleTimeRangeChange(() => {
          this.renderDrawings();
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

        // Auto-resize observer
        if (typeof ResizeObserver !== 'undefined') {
          this.resizeObserver = new ResizeObserver((entries) => {
            if (entries.length === 0 || !this.chart) return;
            const { width, height } = entries[0].contentRect;
            this.chart.applyOptions({ width, height: height || 460 });
            this.syncCanvasSize();
            this.renderDrawings();
          });
          this.resizeObserver.observe(container);
        }
      }

      // Prepare Series Data
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

      // Remove existing series
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
        scaleMargins: {
          top: 0.8,
          bottom: 0
        }
      });
      this.volumeSeries.setData(volumeData);

      // Add Main Chart Series
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
          color: '#6366f1',
          lineWidth: 2
        });
        this.lineSeries.setData(lineData);
      } else if (chartType === 'area') {
        this.areaSeries = this.chart.addSeries(AreaSeries, {
          topColor: 'rgba(99, 102, 241, 0.4)',
          bottomColor: 'rgba(99, 102, 241, 0.02)',
          lineColor: '#6366f1',
          lineWidth: 2
        });
        this.areaSeries.setData(lineData);
      }

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

      this.renderAllIndicators();
      this.chart.timeScale().fitContent();

      // Sync and render drawing overlay
      this.syncCanvasSize();
      setTimeout(() => this.renderDrawings(), 50);
    } catch (e) {
      // ignore headless test environments
    }
  }

  // =========================================================================
  // DRAWING CANVAS ENGINE (REQUIREMENTS 1 & 2)
  // =========================================================================

  selectDrawingTool(tool: DrawingTool): void {
    this.selectedDrawingTool.set(tool);
    this.selectedDrawingId.set(null);
    this.currentDraftDrawing = null;
    this.isDrawingMouseDown = false;
  }

  toggleMagnet(): void {
    this.isMagnetMode.update(v => !v);
  }

  toggleLockDrawings(): void {
    this.isDrawingsLocked.update(v => !v);
  }

  toggleHideDrawings(): void {
    this.isDrawingsHidden.update(v => !v);
    this.renderDrawings();
  }

  clearAllDrawings(): void {
    this.drawings.set([]);
    this.selectedDrawingId.set(null);
    this.currentDraftDrawing = null;
    this.saveDrawingsForSymbol(this.selectedSymbol());
    this.renderDrawings();
  }

  deleteSelectedDrawing(): void {
    const id = this.selectedDrawingId();
    if (!id || this.isDrawingsLocked()) return;

    this.drawings.update(list => list.filter(d => d.id !== id));
    this.selectedDrawingId.set(null);
    this.saveDrawingsForSymbol(this.selectedSymbol());
    this.renderDrawings();
  }

  zoomIn(): void {
    if (this.chart) {
      try {
        const timeScale = this.chart.timeScale();
        const range = timeScale.getVisibleLogicalRange();
        if (range) {
          const delta = (range.to - range.from) * 0.2;
          timeScale.setVisibleLogicalRange({
            from: range.from + delta,
            to: range.to - delta
          });
        }
      } catch (e) {
        // ignore
      }
    }
  }

  zoomOut(): void {
    if (this.chart) {
      try {
        const timeScale = this.chart.timeScale();
        const range = timeScale.getVisibleLogicalRange();
        if (range) {
          const delta = (range.to - range.from) * 0.25;
          timeScale.setVisibleLogicalRange({
            from: range.from - delta,
            to: range.to + delta
          });
        }
      } catch (e) {
        // ignore
      }
    }
  }

  private syncCanvasSize(): void {
    const canvas = this.drawingCanvasRef()?.nativeElement;
    const container = this.chartContainerRef()?.nativeElement;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
  }

  private getPointFromEvent(e: MouseEvent): DrawingPoint | null {
    const canvas = this.drawingCanvasRef()?.nativeElement;
    if (!canvas || !this.chart) return null;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const timeRaw: any = this.chart.timeScale().coordinateToTime(x as any);
    const priceRaw: any = this.candlestickSeries?.coordinateToPrice(y as any) ??
                          this.lineSeries?.coordinateToPrice(y as any) ??
                          this.areaSeries?.coordinateToPrice(y as any);

    let price: number = typeof priceRaw === 'number' ? priceRaw : 0;
    let time: string | number = typeof timeRaw === 'object' && timeRaw !== null
      ? `${timeRaw.year}-${String(timeRaw.month).padStart(2, '0')}-${String(timeRaw.day).padStart(2, '0')}`
      : (timeRaw ?? Math.floor(Date.now() / 1000));

    // Magnet mode snap to nearest candle O/H/L/C
    if (this.isMagnetMode()) {
      const snapped = this.snapToNearestCandle(x, y);
      if (snapped) {
        time = typeof snapped.time === 'object' && snapped.time !== null
          ? `${snapped.time.year}-${String(snapped.time.month).padStart(2, '0')}-${String(snapped.time.day).padStart(2, '0')}`
          : snapped.time;
        price = snapped.price;
      }
    }

    return { time, price, screenX: x, screenY: y };
  }

  private snapToNearestCandle(x: number, y: number): { time: any; price: number } | null {
    const candles = this.candleData();
    if (!candles || candles.length === 0 || !this.chart) return null;

    let bestDist = Infinity;
    let bestSnap: { time: any; price: number } | null = null;

    candles.forEach(c => {
      const cx = this.chart!.timeScale().timeToCoordinate(c.timestamp as any);
      if (cx == null) return;

      const dx = Math.abs(Number(cx) - x);
      if (dx < 30) {
        const prices = [c.open, c.high, c.low, c.close];
        prices.forEach(p => {
          const cy = this.candlestickSeries?.priceToCoordinate(p as any);
          if (cy != null) {
            const dy = Math.abs(Number(cy) - y);
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < bestDist) {
              bestDist = dist;
              bestSnap = { time: c.timestamp, price: p };
            }
          }
        });
      }
    });

    return bestSnap;
  }

  private findDrawingAtPoint(x: number, y: number): ChartDrawing | null {
    const drawings = this.drawings();
    if (!this.chart || drawings.length === 0) return null;

    const timeScale = this.chart.timeScale();
    const threshold = 14;

    for (let i = drawings.length - 1; i >= 0; i--) {
      const d = drawings[i];
      const coords = d.points.map(p => {
        let px: number | null = null;
        let py: number | null = null;
        if (p.time != null) {
          px = timeScale.timeToCoordinate(p.time as any) as number | null;
        }
        if (p.price != null && this.candlestickSeries) {
          py = this.candlestickSeries.priceToCoordinate(p.price as any) as number | null;
        } else if (p.price != null && this.lineSeries) {
          py = this.lineSeries.priceToCoordinate(p.price as any) as number | null;
        }
        return { x: px ?? p.screenX ?? 0, y: py ?? p.screenY ?? 0 };
      });

      if (coords.length === 0) continue;

      if (d.type === 'trendline' || d.type === 'ray') {
        if (coords.length >= 2) {
          const dist = this.distToSegment(x, y, coords[0].x, coords[0].y, coords[1].x, coords[1].y);
          if (dist <= threshold) return d;
        }
      } else if (d.type === 'horizontal') {
        if (Math.abs(y - coords[0].y) <= threshold) return d;
      } else if (d.type === 'vertical') {
        if (Math.abs(x - coords[0].x) <= threshold) return d;
      } else if (d.type === 'rectangle' || d.type === 'measure') {
        if (coords.length >= 2) {
          const minX = Math.min(coords[0].x, coords[1].x) - 6;
          const maxX = Math.max(coords[0].x, coords[1].x) + 6;
          const minY = Math.min(coords[0].y, coords[1].y) - 6;
          const maxY = Math.max(coords[0].y, coords[1].y) + 6;
          if (x >= minX && x <= maxX && y >= minY && y <= maxY) return d;
        }
      } else if (d.type === 'brush') {
        for (let j = 0; j < coords.length - 1; j++) {
          const dist = this.distToSegment(x, y, coords[j].x, coords[j].y, coords[j + 1].x, coords[j + 1].y);
          if (dist <= threshold) return d;
        }
      } else if (d.type === 'text') {
        if (Math.hypot(x - coords[0].x, y - coords[0].y) <= 35) return d;
      }
    }
    return null;
  }

  private distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
    const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
  }

  @HostListener('window:keydown', ['$event'])
  onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      if (this.currentDraftDrawing) {
        this.currentDraftDrawing = null;
        this.renderDrawings();
      }
      this.selectedDrawingId.set(null);
      this.selectDrawingTool('cursor');
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      const activeTag = (document.activeElement?.tagName || '').toLowerCase();
      if (activeTag !== 'input' && activeTag !== 'textarea') {
        if (this.selectedDrawingId()) {
          e.preventDefault();
          this.deleteSelectedDrawing();
        }
      }
    }
  }

  onCanvasMouseDown(e: MouseEvent): void {
    if (this.isDrawingsLocked() || this.isDrawingsHidden()) return;

    const tool = this.selectedDrawingTool();
    const canvas = this.drawingCanvasRef()?.nativeElement;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (tool === 'cursor') {
      const hit = this.findDrawingAtPoint(x, y);
      if (hit) {
        this.selectedDrawingId.set(hit.id);
      } else {
        this.selectedDrawingId.set(null);
      }
      this.renderDrawings();
      return;
    }

    const point = this.getPointFromEvent(e);
    if (!point) return;

    this.isDrawingMouseDown = true;

    if (tool === 'horizontal' || tool === 'vertical' || tool === 'text') {
      // 1-Click tools
      let textContent: string | undefined;
      if (tool === 'text') {
        const input = prompt('Enter annotation text:', 'Key Level');
        if (!input) {
          this.isDrawingMouseDown = false;
          return;
        }
        textContent = input;
      }

      const newDrawing: ChartDrawing = {
        id: 'draw_' + Date.now(),
        type: tool,
        symbol: this.selectedSymbol(),
        points: [point],
        color: this.activeDrawingColor(),
        lineWidth: this.activeLineWidth(),
        text: textContent,
        createdAt: Date.now()
      };

      this.drawings.update(d => [...d, newDrawing]);
      this.saveDrawingsForSymbol(this.selectedSymbol());
      this.selectedDrawingId.set(newDrawing.id);
      this.renderDrawings();
      this.selectDrawingTool('cursor');
      this.isDrawingMouseDown = false;
      return;
    }

    if (tool === 'brush') {
      this.currentDraftDrawing = {
        id: 'draw_' + Date.now(),
        type: 'brush',
        symbol: this.selectedSymbol(),
        points: [point],
        color: this.activeDrawingColor(),
        lineWidth: this.activeLineWidth(),
        createdAt: Date.now()
      };
      return;
    }

    // 2-point tools (trendline, ray, rectangle, measure)
    if (!this.currentDraftDrawing) {
      this.currentDraftDrawing = {
        id: 'draw_' + Date.now(),
        type: tool,
        symbol: this.selectedSymbol(),
        points: [point, { ...point }],
        color: this.activeDrawingColor(),
        lineWidth: this.activeLineWidth(),
        filled: tool === 'rectangle' || tool === 'measure',
        createdAt: Date.now()
      };
    } else {
      // Second click completes 2-point drawing
      this.currentDraftDrawing.points[1] = point;
      const completed = this.currentDraftDrawing;
      this.drawings.update(d => [...d, completed]);
      this.saveDrawingsForSymbol(this.selectedSymbol());
      this.selectedDrawingId.set(completed.id);
      this.currentDraftDrawing = null;
      this.renderDrawings();
      this.selectDrawingTool('cursor');
      this.isDrawingMouseDown = false;
    }
  }

  onCanvasMouseMove(e: MouseEvent): void {
    if (!this.currentDraftDrawing || this.isDrawingsHidden()) return;

    const point = this.getPointFromEvent(e);
    if (!point) return;

    if (this.currentDraftDrawing.type === 'brush') {
      if (this.isDrawingMouseDown) {
        this.currentDraftDrawing.points.push(point);
        this.renderDrawings();
      }
    } else {
      // Live preview endpoint
      this.currentDraftDrawing.points[1] = point;
      this.renderDrawings();
    }
  }

  onCanvasMouseUp(): void {
    if (this.currentDraftDrawing && this.currentDraftDrawing.type === 'brush') {
      const completed = this.currentDraftDrawing;
      this.drawings.update(d => [...d, completed]);
      this.saveDrawingsForSymbol(this.selectedSymbol());
      this.selectedDrawingId.set(completed.id);
      this.currentDraftDrawing = null;
      this.selectDrawingTool('cursor');
      this.renderDrawings();
    }
    this.isDrawingMouseDown = false;
  }

  renderDrawings(): void {
    const canvas = this.drawingCanvasRef()?.nativeElement;
    if (!canvas || !this.chart || typeof window === 'undefined') return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

    if (this.isDrawingsHidden()) {
      ctx.restore();
      return;
    }

    const allDrawings = [...this.drawings()];
    if (this.currentDraftDrawing) {
      allDrawings.push(this.currentDraftDrawing);
    }

    const timeScale = this.chart.timeScale();
    const selId = this.selectedDrawingId();

    allDrawings.forEach(d => {
      const isSelected = d.id === selId;
      const drawColor = isSelected ? '#38bdf8' : (d.color || '#38bdf8');
      const drawLineWidth = isSelected ? Math.max(3, (d.lineWidth || 2) + 1) : (d.lineWidth || 2);

      ctx.strokeStyle = drawColor;
      ctx.fillStyle = drawColor;
      ctx.lineWidth = drawLineWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Convert stored points to screen coordinates
      const coords = d.points.map(p => {
        let x: number | null = null;
        let y: number | null = null;

        if (p.time != null) {
          x = timeScale.timeToCoordinate(p.time as any) as number | null;
        }
        if (p.price != null && this.candlestickSeries) {
          y = this.candlestickSeries.priceToCoordinate(p.price as any) as number | null;
        } else if (p.price != null && this.lineSeries) {
          y = this.lineSeries.priceToCoordinate(p.price as any) as number | null;
        }

        return {
          x: x ?? p.screenX ?? 0,
          y: y ?? p.screenY ?? 0
        };
      });

      if (coords.length === 0) return;

      if (d.type === 'trendline' && coords.length >= 2) {
        ctx.beginPath();
        ctx.moveTo(coords[0].x, coords[0].y);
        ctx.lineTo(coords[1].x, coords[1].y);
        ctx.stroke();

        // Draw handles at points
        this.drawAnchorHandle(ctx, coords[0].x, coords[0].y, drawColor, isSelected);
        this.drawAnchorHandle(ctx, coords[1].x, coords[1].y, drawColor, isSelected);
      } else if (d.type === 'horizontal' && coords.length >= 1) {
        ctx.setLineDash(isSelected ? [6, 3] : [4, 4]);
        ctx.beginPath();
        ctx.moveTo(0, coords[0].y);
        ctx.lineTo(canvas.width / dpr, coords[0].y);
        ctx.stroke();
        ctx.setLineDash([]);

        // Right scale badge
        const priceLabel = d.points[0].price.toFixed(2);
        this.drawPriceTag(ctx, canvas.width / dpr - 65, coords[0].y, priceLabel, drawColor, isSelected);
      } else if (d.type === 'vertical' && coords.length >= 1) {
        ctx.setLineDash(isSelected ? [6, 3] : [4, 4]);
        ctx.beginPath();
        ctx.moveTo(coords[0].x, 0);
        ctx.lineTo(coords[0].x, canvas.height / dpr);
        ctx.stroke();
        ctx.setLineDash([]);
      } else if (d.type === 'ray' && coords.length >= 2) {
        const dx = coords[1].x - coords[0].x;
        const dy = coords[1].y - coords[0].y;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const extendedX = coords[0].x + (dx / len) * 3000;
        const extendedY = coords[0].y + (dy / len) * 3000;

        ctx.beginPath();
        ctx.moveTo(coords[0].x, coords[0].y);
        ctx.lineTo(extendedX, extendedY);
        ctx.stroke();

        this.drawAnchorHandle(ctx, coords[0].x, coords[0].y, drawColor, isSelected);
        this.drawAnchorHandle(ctx, coords[1].x, coords[1].y, drawColor, isSelected);
      } else if (d.type === 'rectangle' && coords.length >= 2) {
        const rx = Math.min(coords[0].x, coords[1].x);
        const ry = Math.min(coords[0].y, coords[1].y);
        const rw = Math.abs(coords[1].x - coords[0].x);
        const rh = Math.abs(coords[1].y - coords[0].y);

        ctx.fillStyle = isSelected ? 'rgba(56, 189, 248, 0.22)' : 'rgba(56, 189, 248, 0.12)';
        ctx.fillRect(rx, ry, rw, rh);
        ctx.strokeRect(rx, ry, rw, rh);

        this.drawAnchorHandle(ctx, coords[0].x, coords[0].y, drawColor, isSelected);
        this.drawAnchorHandle(ctx, coords[1].x, coords[1].y, drawColor, isSelected);
      } else if (d.type === 'brush' && coords.length > 1) {
        ctx.beginPath();
        ctx.moveTo(coords[0].x, coords[0].y);
        for (let i = 1; i < coords.length; i++) {
          ctx.lineTo(coords[i].x, coords[i].y);
        }
        ctx.stroke();
      } else if (d.type === 'text' && coords.length >= 1) {
        const text = d.text || 'Annotation';
        ctx.font = '600 12px "Plus Jakarta Sans", sans-serif';
        const textW = ctx.measureText(text).width;

        ctx.fillStyle = isSelected ? 'rgba(30, 58, 138, 0.95)' : 'rgba(15, 23, 42, 0.85)';
        ctx.strokeStyle = drawColor;
        ctx.lineWidth = isSelected ? 2 : 1;
        ctx.beginPath();
        ctx.roundRect(coords[0].x - 4, coords[0].y - 18, textW + 16, 24, 4);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#f8fafc';
        ctx.fillText(text, coords[0].x + 4, coords[0].y - 2);
      } else if (d.type === 'measure' && coords.length >= 2) {
        const rx = Math.min(coords[0].x, coords[1].x);
        const ry = Math.min(coords[0].y, coords[1].y);
        const rw = Math.abs(coords[1].x - coords[0].x);
        const rh = Math.abs(coords[1].y - coords[0].y);

        const deltaPrice = d.points[1].price - d.points[0].price;
        const pct = d.points[0].price !== 0 ? (deltaPrice / d.points[0].price) * 100 : 0;
        const isPositive = deltaPrice >= 0;

        ctx.fillStyle = isPositive ? 'rgba(16, 185, 129, 0.14)' : 'rgba(244, 63, 94, 0.14)';
        ctx.strokeStyle = isPositive ? '#10b981' : '#f43f5e';
        ctx.fillRect(rx, ry, rw, rh);
        ctx.strokeRect(rx, ry, rw, rh);

        const label = `${isPositive ? '+' : ''}${deltaPrice.toFixed(2)} (${isPositive ? '+' : ''}${pct.toFixed(2)}%)`;
        ctx.font = 'bold 11px monospace';
        ctx.fillStyle = isPositive ? '#34d399' : '#fb7185';
        ctx.fillText(label, rx + 6, ry + 16);
      }
    });

    ctx.restore();
  }

  private drawAnchorHandle(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, isSelected: boolean = false): void {
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = color;
    ctx.lineWidth = isSelected ? 2.5 : 2;
    ctx.beginPath();
    ctx.arc(x, y, isSelected ? 5.5 : 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  private drawPriceTag(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, color: string, isSelected: boolean = false): void {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x, y - 9, 60, 18, 3);
    ctx.fill();

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 10px monospace';
    ctx.fillText(text, x + 6, y + 4);
  }

  private loadDrawingsForSymbol(symbol: string): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const raw = localStorage.getItem(`tv_drawings_${symbol}`);
      if (raw) {
        this.drawings.set(JSON.parse(raw));
      } else {
        this.drawings.set([]);
      }
    } catch (e) {
      this.drawings.set([]);
    }
  }

  private saveDrawingsForSymbol(symbol: string): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(`tv_drawings_${symbol}`, JSON.stringify(this.drawings()));
    } catch (e) {
      // ignore
    }
  }

  // =========================================================================
  // INDICATOR ENGINE & MANAGEMENT
  // =========================================================================

  renderAllIndicators(): void {
    if (!this.chart || typeof window === 'undefined') return;

    try {
      const candles = this.candleData();
      if (!candles || candles.length === 0) return;

      const active = this.activeIndicators();
      const currentActiveIds = new Set<string>();

      active.forEach(ind => {
        if (!ind.enabled) return;

        const renderSeriesList = calculateIndicatorSeries(ind, candles);
        renderSeriesList.forEach(rs => {
          currentActiveIds.add(rs.id);

          let series = this.indicatorSeriesMap.get(rs.id);
          if (!series) {
            if (rs.type === 'histogram') {
              series = this.chart!.addSeries(HistogramSeries, {
                color: rs.color,
                priceScaleId: rs.priceScaleId || ''
              });
            } else {
              series = this.chart!.addSeries(LineSeries, {
                color: rs.color,
                lineWidth: (rs.lineWidth || 2) as any,
                lineStyle: rs.lineStyle || 0,
                priceScaleId: rs.overlay ? 'right' : (rs.priceScaleId || '')
              });
            }

            if (rs.scaleMargins) {
              series.priceScale().applyOptions({ scaleMargins: rs.scaleMargins });
            }

            this.indicatorSeriesMap.set(rs.id, series);
          } else {
            series.applyOptions({
              color: rs.color,
              lineWidth: (rs.lineWidth || 2) as any
            });
          }

          if (rs.data && rs.data.length > 0) {
            series.setData(rs.data as any);
          }
        });
      });

      this.indicatorSeriesMap.forEach((series, id) => {
        if (!currentActiveIds.has(id)) {
          try {
            this.chart!.removeSeries(series);
          } catch (e) {
            // ignore
          }
          this.indicatorSeriesMap.delete(id);
        }
      });
    } catch (e) {
      // ignore
    }
  }

  openIndicatorModal(): void {
    this.isIndicatorModalOpen.set(true);
  }

  closeIndicatorModal(): void {
    this.isIndicatorModalOpen.set(false);
  }

  setIndicatorCategory(catId: string): void {
    this.selectedIndicatorCategory.set(catId);
  }

  addIndicator(def: IndicatorDefinition): void {
    const defaultParams: Record<string, any> = { ...def.defaultParams };

    const instanceId = `${def.id}_${Date.now()}`;
    const newActive: ActiveIndicator = {
      instanceId,
      defId: def.id,
      name: def.name,
      shortName: def.shortName,
      category: def.category,
      color: def.defaultColor,
      lineWidth: 2,
      enabled: true,
      params: defaultParams,
      isOverlay: def.isOverlay
    };

    this.activeIndicators.update(list => [...list, newActive]);
  }

  removeIndicator(instanceId: string): void {
    this.activeIndicators.update(list => list.filter(i => i.instanceId !== instanceId));
  }

  toggleIndicatorEnabled(instanceId: string): void {
    this.activeIndicators.update(list =>
      list.map(i => i.instanceId === instanceId ? { ...i, enabled: !i.enabled } : i)
    );
  }

  clearAllIndicators(): void {
    this.activeIndicators.set([]);
  }

  openIndicatorSettings(indicator: ActiveIndicator): void {
    this.editingIndicator.set(indicator);
    this.editingParams.set({ ...indicator.params });
    this.editingColor.set(indicator.color);
    this.editingLineWidth.set(indicator.lineWidth);
  }

  updateEditingParam(paramKey: string, value: any): void {
    const current = this.editingParams();
    this.editingParams.set({ ...current, [paramKey]: value });
  }

  closeIndicatorSettings(): void {
    this.editingIndicator.set(null);
  }

  saveIndicatorSettings(): void {
    const current = this.editingIndicator();
    if (!current) return;

    this.activeIndicators.update(list =>
      list.map(i => {
        if (i.instanceId === current.instanceId) {
          return {
            ...i,
            params: { ...this.editingParams() },
            color: this.editingColor(),
            lineWidth: this.editingLineWidth()
          };
        }
        return i;
      })
    );

    this.closeIndicatorSettings();
  }

  getEditingDefinition(): IndicatorDefinition | undefined {
    const ind = this.editingIndicator();
    if (!ind) return undefined;
    return this.indicatorLibrary().find(d => d.id === ind.defId);
  }

  isIndicatorActive(defId: string): boolean {
    return this.activeIndicators().some(i => i.defId === defId);
  }

  // =========================================================================
  // WATCHLIST, SEARCH, NAVIGATION & HELPERS
  // =========================================================================

  setCategory(cat: MarketCategory): void {
    this.activeCategory.set(cat);
  }

  setInterval(iv: ChartInterval): void {
    this.currentInterval.set(iv);
    this.fetchCandles(this.selectedSymbol(), iv);
  }

  setTimeframe(tf: TimeframeRange): void {
    this.currentTimeframe.set(tf);
    this.fetchCandles(this.selectedSymbol(), this.currentInterval());
  }

  setChartType(type: ChartType): void {
    this.currentChartType.set(type);
  }

  toggleFullscreen(): void {
    this.isFullscreen.update(v => !v);
    setTimeout(() => {
      if (this.chart) {
        this.chart.timeScale().fitContent();
      }
      this.syncCanvasSize();
      this.renderDrawings();
    }, 100);
  }

  fitChart(): void {
    if (this.chart) {
      this.chart.timeScale().fitContent();
      this.renderDrawings();
    }
  }

  refreshCurrentInstrument(): void {
    const sym = this.selectedSymbol();
    this.fetchQuote(sym);
    this.fetchCandles(sym, this.currentInterval());
  }

  retryFetch(): void {
    this.errorMessage.set(null);
    this.isRateLimited.set(false);
    this.refreshCurrentInstrument();
  }

  onSearchInput(query: string): void {
    this.searchQuery.set(query);
    this.searchSubject.next(query);
  }

  onSearchSubmit(): void {
    const q = this.searchQuery().trim();
    if (q) {
      this.loadInstrument(q);
      this.searchQuery.set('');
      this.showDropdown.set(false);
    }
  }

  selectSearchResult(item: StockSearchItem): void {
    this.loadInstrument(item.symbol, item.name, item.region, item.type);
    this.searchQuery.set('');
    this.showDropdown.set(false);
  }

  clearSearch(): void {
    this.searchQuery.set('');
    this.searchResults.set([]);
    this.showDropdown.set(false);
  }

  selectWatchlistItem(item: WatchlistItem): void {
    this.loadInstrument(item.symbol, item.name, item.exchange ?? undefined, item.category);
  }

  updateWatchlistItem(symbol: string, price?: number | null, change?: number | null, changePercent?: string | null): void {
    this.watchlist.update(list =>
      list.map(item => {
        if (item.symbol.toUpperCase() === symbol.toUpperCase()) {
          return {
            ...item,
            price: price ?? item.price,
            change: change ?? item.change,
            changePercent: changePercent ?? item.changePercent
          };
        }
        return item;
      })
    );
  }

  refreshWatchlistQuotes(): void {
    const items = this.watchlist();
    const batch = items.slice(0, 10);
    batch.forEach(item => {
      this.marketService.getQuote(item.symbol).subscribe({
        next: (quote) => {
          this.updateWatchlistItem(item.symbol, quote.price, quote.change, quote.changePercent);
        },
        error: () => {}
      });
    });
  }

  // Watchlist collapsing
  toggleSectionCollapse(sec: 'indices' | 'stocks' | 'forex' | 'crypto'): void {
    if (sec === 'indices') this.isIndicesCollapsed.update(v => !v);
    if (sec === 'stocks') this.isStocksCollapsed.update(v => !v);
    if (sec === 'forex') this.isForexCollapsed.update(v => !v);
    if (sec === 'crypto') this.isCryptoCollapsed.update(v => !v);
    this.saveWatchlistState();
  }

  toggleIndicesCollapse(): void {
    this.toggleSectionCollapse('indices');
  }

  toggleStocksCollapse(): void {
    this.toggleSectionCollapse('stocks');
  }

  toggleForexCollapse(): void {
    this.toggleSectionCollapse('forex');
  }

  toggleCryptoCollapse(): void {
    this.toggleSectionCollapse('crypto');
  }

  startWatchlistResize(e: MouseEvent): void {
    this.startResizeWatchlist(e);
  }

  // Watchlist Drag and Drop
  onDragStart(e: DragEvent, item: WatchlistItem): void {
    this.draggedItem.set({ symbol: item.symbol, category: item.category });
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', item.symbol);
    }
  }

  onDragOver(e: DragEvent, targetItem: WatchlistItem): void {
    e.preventDefault();
    const dragged = this.draggedItem();
    if (!dragged || dragged.symbol === targetItem.symbol || dragged.category !== targetItem.category) {
      return;
    }

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const pos = e.clientY < midY ? 'above' : 'below';

    this.dragOverTarget.set(targetItem.symbol);
    this.dragOverPosition.set(pos);
  }

  onDragLeave(e: DragEvent): void {
    const related = e.relatedTarget as HTMLElement;
    const current = e.currentTarget as HTMLElement;
    if (!current.contains(related)) {
      this.dragOverTarget.set(null);
      this.dragOverPosition.set(null);
    }
  }

  onDrop(e: DragEvent, targetItem: WatchlistItem): void {
    e.preventDefault();
    const dragged = this.draggedItem();
    if (!dragged || dragged.symbol === targetItem.symbol || dragged.category !== targetItem.category) {
      this.clearDragState();
      return;
    }

    const pos = this.dragOverPosition();
    const currentList = this.watchlist();
    const draggedIdx = currentList.findIndex(i => i.symbol === dragged.symbol);
    const targetIdx = currentList.findIndex(i => i.symbol === targetItem.symbol);

    if (draggedIdx === -1 || targetIdx === -1) {
      this.clearDragState();
      return;
    }

    const [moved] = currentList.splice(draggedIdx, 1);
    const insertIdx = pos === 'above' ? targetIdx : targetIdx + 1;
    currentList.splice(insertIdx > draggedIdx ? insertIdx - 1 : insertIdx, 0, moved);

    this.watchlist.set([...currentList]);
    this.clearDragState();
    this.saveWatchlistState();
  }

  onDragEnd(): void {
    this.clearDragState();
  }

  private clearDragState(): void {
    this.draggedItem.set(null);
    this.dragOverTarget.set(null);
    this.dragOverPosition.set(null);
  }

  // Resizable Watchlist Pane
  startResizeWatchlist(e: MouseEvent): void {
    if (e.preventDefault) e.preventDefault();
    this.isResizingWatchlist.set(true);
    this.resizeStartX = e.clientX;
    this.resizeStartWidth = this.watchlistWidth();

    this.boundOnMouseMove = (moveEvent: MouseEvent) => {
      const delta = this.resizeStartX - moveEvent.clientX;
      const newWidth = Math.min(600, Math.max(260, this.resizeStartWidth + delta));
      this.watchlistWidth.set(newWidth);
      this.syncCanvasSize();
      this.renderDrawings();
    };

    this.boundOnMouseUp = () => {
      this.isResizingWatchlist.set(false);
      if (this.boundOnMouseMove) document.removeEventListener('mousemove', this.boundOnMouseMove);
      if (this.boundOnMouseUp) document.removeEventListener('mouseup', this.boundOnMouseUp);
      this.saveWatchlistState();
      if (this.chart) {
        this.chart.timeScale().fitContent();
      }
      this.syncCanvasSize();
      this.renderDrawings();
    };

    document.addEventListener('mousemove', this.boundOnMouseMove);
    document.addEventListener('mouseup', this.boundOnMouseUp);
  }

  private saveWatchlistState(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const collapsedState = {
        indices: this.isIndicesCollapsed(),
        stocks: this.isStocksCollapsed(),
        forex: this.isForexCollapsed(),
        crypto: this.isCryptoCollapsed()
      };
      localStorage.setItem('portfolio_market_watchlist_collapsed', JSON.stringify(collapsedState));
      localStorage.setItem('portfolio_watchlist_width', this.watchlistWidth().toString());

      const state = {
        width: this.watchlistWidth(),
        collapsed: collapsedState,
        order: this.watchlist().map(w => w.symbol)
      };
      localStorage.setItem('market_watchlist_pref', JSON.stringify(state));
    } catch (e) {
      // ignore
    }
  }

  private loadSavedWatchlistState(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const raw = localStorage.getItem('market_watchlist_pref');
      if (!raw) return;
      const state = JSON.parse(raw);
      if (state.width && typeof state.width === 'number') {
        this.watchlistWidth.set(state.width);
      }
      if (state.collapsed) {
        this.isIndicesCollapsed.set(!!state.collapsed.indices);
        this.isStocksCollapsed.set(!!state.collapsed.stocks);
        this.isForexCollapsed.set(!!state.collapsed.forex);
        this.isCryptoCollapsed.set(!!state.collapsed.crypto);
      }
      if (state.order && Array.isArray(state.order)) {
        const map = new Map(this.watchlist().map(i => [i.symbol, i]));
        const sorted: WatchlistItem[] = [];
        state.order.forEach((sym: string) => {
          const item = map.get(sym);
          if (item) {
            sorted.push(item);
            map.delete(sym);
          }
        });
        map.forEach(item => sorted.push(item));
        this.watchlist.set(sorted);
      }
    } catch (e) {
      // ignore
    }
  }

  formatCurrencySymbol(symbol: string): string {
    if (this.marketService.isIndianSymbol(symbol)) return '₹';
    if (symbol.startsWith('EUR/')) return '€';
    if (symbol.startsWith('GBP/')) return '£';
    return '$';
  }
}
