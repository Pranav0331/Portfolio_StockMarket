import {
  Component,
  inject,
  OnInit,
  signal,
  computed,
  OnDestroy,
  ElementRef,
  viewChild,
  effect
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subject, Subscription, of } from 'rxjs';
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

  // Chart Container DOM Reference
  readonly chartContainerRef = viewChild<ElementRef<HTMLDivElement>>('chartContainer');

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

  // Real Candlestick Data Cache
  readonly candleData = signal<Candle[]>([]);

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

  // Count helper for category badges
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

  // Watchlist Catalog (Strictly 4 separate categories: indices, stocks, forex, crypto)
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
      // Track active indicators
      this.activeIndicators();
      const data = this.candleData();
      if (this.chart && data && data.length > 0) {
        this.renderAllIndicators();
      }
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

    // Load persisted watchlist reordering and collapsed state
    this.loadSavedWatchlistState();

    // Handle query params e.g. /dashboard/market?symbol=BTC/USD
    this.queryParamSub = this.route.queryParams.subscribe((params) => {
      const symbolParam = params['symbol'] || params['q'];
      if (symbolParam) {
        this.loadInstrument(symbolParam);
      } else {
        // Load default initial instrument
        this.loadInstrument(this.selectedSymbol());
      }
    });

    // Background watchlist live price refresh
    this.refreshWatchlistQuotes();
  }

  ngOnDestroy(): void {
    this.searchSubscription?.unsubscribe();
    this.queryParamSub?.unsubscribe();
    if (this.boundOnMouseMove) {
      document.removeEventListener('mousemove', this.boundOnMouseMove);
    }
    if (this.boundOnMouseUp) {
      document.removeEventListener('mouseup', this.boundOnMouseUp);
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

    // Fetch both Quote and Candles in parallel
    this.fetchQuote(cleanSym, name);
    this.fetchCandles(cleanSym, this.currentInterval());
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

    // Determine output size based on timeframe
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
  // LIGHTWEIGHT CHARTS INTEGRATION
  // =========================================================================

  private initOrUpdateChart(container: HTMLDivElement, candles: Candle[], chartType: ChartType): void {
    if (!candles || candles.length === 0 || typeof window === 'undefined') return;

    try {
      const isDark = !document.documentElement.getAttribute('data-theme')?.includes('light');

      const bgColor = 'transparent';
      const textColor = isDark ? '#94a3b8' : '#64748b';
      const gridColor = isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(15, 23, 42, 0.05)';
      const borderColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.08)';

      if (!this.chart) {
        // Clear container first
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

        // Track crosshair move for dynamic OHLC display
        this.chart.subscribeCrosshairMove((param) => {
          if (!param.time || !param.point) {
            // Reset to latest bar
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

        // Auto-resize on window / container resize
        if (typeof ResizeObserver !== 'undefined') {
          this.resizeObserver = new ResizeObserver((entries) => {
            if (entries.length === 0 || !this.chart) return;
            const { width, height } = entries[0].contentRect;
            this.chart.applyOptions({ width, height: height || 460 });
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

      // Remove existing main series if any
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

      // Add Volume Series at the bottom
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

      // Add Selected Main Series
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

      // Set Initial Hover Bar to Latest Bar
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

      // Render Active Indicators on the chart
      this.renderAllIndicators();

      // Fit content
      this.chart.timeScale().fitContent();
    } catch (e) {
      // In headless test environments without full canvas, ignore gracefully
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

      // 1. Calculate and update series for all active enabled indicators
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
            // Apply updated options (color, width, etc.)
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

      // 2. Remove stale series no longer active or disabled
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
      // ignore headless canvas errors
    }
  }

  openIndicatorModal(): void {
    this.isIndicatorModalOpen.set(true);
  }

  closeIndicatorModal(): void {
    this.isIndicatorModalOpen.set(false);
  }

  setIndicatorCategory(cat: string): void {
    this.selectedIndicatorCategory.set(cat);
  }

  isIndicatorActive(defId: string): boolean {
    return this.activeIndicators().some(i => i.defId === defId);
  }

  getActiveIndicatorCount(defId: string): number {
    return this.activeIndicators().filter(i => i.defId === defId).length;
  }

  addIndicator(def: IndicatorDefinition): void {
    const instanceId = `${def.id}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newActive: ActiveIndicator = {
      instanceId,
      defId: def.id,
      name: def.name,
      shortName: def.shortName,
      category: def.category,
      enabled: true,
      params: { ...def.defaultParams },
      color: def.defaultColor,
      lineWidth: 2,
      isOverlay: def.isOverlay
    };

    this.activeIndicators.update(list => [...list, newActive]);
  }

  removeIndicator(instanceId: string): void {
    // Remove series directly from map and chart
    this.indicatorSeriesMap.forEach((series, key) => {
      if (key.startsWith(instanceId)) {
        if (this.chart) {
          try {
            this.chart.removeSeries(series);
          } catch (e) {
            // ignore
          }
        }
        this.indicatorSeriesMap.delete(key);
      }
    });

    this.activeIndicators.update(list => list.filter(i => i.instanceId !== instanceId));
  }

  toggleIndicatorEnabled(instanceId: string): void {
    this.activeIndicators.update(list =>
      list.map(i => {
        if (i.instanceId === instanceId) {
          return { ...i, enabled: !i.enabled };
        }
        return i;
      })
    );
  }

  openIndicatorSettings(ind: ActiveIndicator): void {
    this.editingIndicator.set(ind);
    this.editingParams.set({ ...ind.params });
    this.editingColor.set(ind.color);
    this.editingLineWidth.set(ind.lineWidth);
  }

  updateEditingParam(key: string, val: any): void {
    const current = { ...this.editingParams() };
    current[key] = val;
    this.editingParams.set(current);
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
            lineWidth: Number(this.editingLineWidth()) || 2
          };
        }
        return i;
      })
    );

    this.editingIndicator.set(null);
  }

  cancelIndicatorSettings(): void {
    this.editingIndicator.set(null);
  }

  clearAllIndicators(): void {
    if (this.chart) {
      this.indicatorSeriesMap.forEach(s => {
        try {
          this.chart!.removeSeries(s);
        } catch (e) {
          // ignore
        }
      });
    }
    this.indicatorSeriesMap.clear();
    this.activeIndicators.set([]);
  }

  // =========================================================================
  // TOOLBAR INTERACTIONS
  // =========================================================================

  setChartType(type: ChartType): void {
    this.currentChartType.set(type);
  }

  setInterval(interval: ChartInterval): void {
    this.currentInterval.set(interval);
    this.fetchCandles(this.selectedSymbol(), interval);
  }

  setTimeframe(tf: TimeframeRange): void {
    this.currentTimeframe.set(tf);

    // Map timeframe to an optimal interval
    let mappedInterval: ChartInterval = '5min';
    switch (tf) {
      case '1D':
        mappedInterval = '5min';
        break;
      case '5D':
        mappedInterval = '15min';
        break;
      case '1M':
        mappedInterval = '1h';
        break;
      case '3M':
        mappedInterval = '4h';
        break;
      case '6M':
      case '1Y':
      case '5Y':
      case 'ALL':
      default:
        mappedInterval = '1day';
        break;
    }

    this.currentInterval.set(mappedInterval);
    this.fetchCandles(this.selectedSymbol(), mappedInterval);
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

  setCategory(category: MarketCategory): void {
    this.activeCategory.set(category);
  }

  // =========================================================================
  // SEARCH & WATCHLIST ACTIONS
  // =========================================================================

  onSearchInput(value: string): void {
    this.searchQuery.set(value);
    if (!value || value.trim().length === 0) {
      this.showDropdown.set(false);
      this.searchResults.set([]);
      return;
    }
    this.searchSubject.next(value);
  }

  onSearchSubmit(): void {
    const query = this.searchQuery().trim();
    if (!query) return;
    this.showDropdown.set(false);
    this.loadInstrument(query);
  }

  selectSearchResult(item: StockSearchItem): void {
    this.searchQuery.set(item.symbol);
    this.showDropdown.set(false);
    this.loadInstrument(item.symbol, item.name, item.region || undefined, item.type || undefined);
  }

  selectWatchlistItem(item: WatchlistItem): void {
    this.loadInstrument(item.symbol, item.name, item.exchange || undefined, item.category);
  }

  clearSearch(): void {
    this.searchQuery.set('');
    this.searchResults.set([]);
    this.showDropdown.set(false);
  }

  toggleIndicesCollapse(): void {
    this.isIndicesCollapsed.update(v => !v);
    this.saveCollapsedState();
  }

  toggleStocksCollapse(): void {
    this.isStocksCollapsed.update(v => !v);
    this.saveCollapsedState();
  }

  toggleForexCollapse(): void {
    this.isForexCollapsed.update(v => !v);
    this.saveCollapsedState();
  }

  toggleCryptoCollapse(): void {
    this.isCryptoCollapsed.update(v => !v);
    this.saveCollapsedState();
  }

  // =========================================================================
  // RESIZABLE WATCHLIST SIDEBAR
  // =========================================================================

  startWatchlistResize(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isResizingWatchlist.set(true);
    this.resizeStartX = event.clientX;
    this.resizeStartWidth = this.watchlistWidth();

    this.boundOnMouseMove = (e: MouseEvent) => this.onWatchlistMouseMove(e);
    this.boundOnMouseUp = (e: MouseEvent) => this.onWatchlistMouseUp(e);

    document.addEventListener('mousemove', this.boundOnMouseMove);
    document.addEventListener('mouseup', this.boundOnMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }

  private onWatchlistMouseMove(event: MouseEvent): void {
    if (!this.isResizingWatchlist()) return;
    // Dragging left edge: moving mouse left (decreasing clientX) expands the right sidebar
    const deltaX = this.resizeStartX - event.clientX;
    const newWidth = Math.min(Math.max(this.resizeStartWidth + deltaX, 260), 600);
    this.watchlistWidth.set(newWidth);

    // Keep Lightweight Chart responsive while resizing
    if (this.chart && this.chartContainerRef()) {
      const container = this.chartContainerRef()!.nativeElement;
      this.chart.applyOptions({
        width: container.clientWidth
      });
    }
  }

  private onWatchlistMouseUp(event: MouseEvent): void {
    if (!this.isResizingWatchlist()) return;
    this.isResizingWatchlist.set(false);

    if (this.boundOnMouseMove) {
      document.removeEventListener('mousemove', this.boundOnMouseMove);
      this.boundOnMouseMove = undefined;
    }
    if (this.boundOnMouseUp) {
      document.removeEventListener('mouseup', this.boundOnMouseUp);
      this.boundOnMouseUp = undefined;
    }
    document.body.style.cursor = '';
    document.body.style.userSelect = '';

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(MarketComponent.STORAGE_KEY_WATCHLIST_WIDTH, this.watchlistWidth().toString());
    }

    // Refresh and fit chart layout
    setTimeout(() => {
      if (this.chart && this.chartContainerRef()) {
        const container = this.chartContainerRef()!.nativeElement;
        this.chart.applyOptions({
          width: container.clientWidth
        });
      }
    }, 20);
  }

  // =========================================================================
  // WATCHLIST DRAG & DROP REORDERING AND LOCAL STORAGE PERSISTENCE
  // =========================================================================

  private static readonly STORAGE_KEY_WATCHLIST_ORDER = 'portfolio_market_watchlist_order';
  private static readonly STORAGE_KEY_COLLAPSED = 'portfolio_market_watchlist_collapsed';
  private static readonly STORAGE_KEY_WATCHLIST_WIDTH = 'portfolio_watchlist_width';

  private loadSavedWatchlistState(): void {
    if (typeof localStorage === 'undefined') return;

    try {
      // 1. Restore collapsed sections (4 sections)
      const savedCollapsed = localStorage.getItem(MarketComponent.STORAGE_KEY_COLLAPSED);
      if (savedCollapsed) {
        const parsed = JSON.parse(savedCollapsed);
        if (parsed.indices !== undefined) this.isIndicesCollapsed.set(parsed.indices);
        if (parsed.stocks !== undefined) this.isStocksCollapsed.set(parsed.stocks);
        if (parsed.forex !== undefined) this.isForexCollapsed.set(parsed.forex);
        if (parsed.crypto !== undefined) this.isCryptoCollapsed.set(parsed.crypto);
      }

      // 2. Restore custom watchlist ordering
      const savedOrder = localStorage.getItem(MarketComponent.STORAGE_KEY_WATCHLIST_ORDER);
      if (savedOrder) {
        const orderArray: string[] = JSON.parse(savedOrder);
        if (Array.isArray(orderArray) && orderArray.length > 0) {
          const currentList = [...this.watchlist()];
          const orderMap = new Map<string, number>();
          orderArray.forEach((sym, idx) => orderMap.set(sym.toUpperCase(), idx));

          currentList.sort((a, b) => {
            const idxA = orderMap.has(a.symbol.toUpperCase()) ? orderMap.get(a.symbol.toUpperCase())! : 999;
            const idxB = orderMap.has(b.symbol.toUpperCase()) ? orderMap.get(b.symbol.toUpperCase())! : 999;
            return idxA - idxB;
          });

          this.watchlist.set(currentList);
        }
      }

      // 3. Restore persisted watchlist width
      const savedWidth = localStorage.getItem(MarketComponent.STORAGE_KEY_WATCHLIST_WIDTH);
      if (savedWidth) {
        const parsedWidth = parseInt(savedWidth, 10);
        if (!isNaN(parsedWidth) && parsedWidth >= 260 && parsedWidth <= 600) {
          this.watchlistWidth.set(parsedWidth);
        }
      }
    } catch (e) {
      console.warn('Failed to load saved watchlist state:', e);
    }
  }

  private saveWatchlistOrder(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const order = this.watchlist().map(w => w.symbol);
      localStorage.setItem(MarketComponent.STORAGE_KEY_WATCHLIST_ORDER, JSON.stringify(order));
    } catch (e) {
      console.warn('Failed to save watchlist order:', e);
    }
  }

  private saveCollapsedState(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const state = {
        indices: this.isIndicesCollapsed(),
        stocks: this.isStocksCollapsed(),
        forex: this.isForexCollapsed(),
        crypto: this.isCryptoCollapsed()
      };
      localStorage.setItem(MarketComponent.STORAGE_KEY_COLLAPSED, JSON.stringify(state));
    } catch (e) {
      console.warn('Failed to save collapsed state:', e);
    }
  }

  onDragStart(event: DragEvent, item: WatchlistItem): void {
    this.draggedItem.set({ symbol: item.symbol, category: item.category });
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', item.symbol);
    }
  }

  onDragOver(event: DragEvent, targetItem: WatchlistItem): void {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }

    const dragged = this.draggedItem();
    if (!dragged || dragged.symbol === targetItem.symbol) {
      this.dragOverTarget.set(null);
      this.dragOverPosition.set(null);
      return;
    }

    const targetElement = (event.currentTarget || event.target) as HTMLElement;
    const rect = targetElement.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const position = event.clientY < midY ? 'above' : 'below';

    this.dragOverTarget.set(targetItem.symbol);
    this.dragOverPosition.set(position);
  }

  onDragLeave(event: DragEvent): void {
    const related = event.relatedTarget as HTMLElement;
    const current = event.currentTarget as HTMLElement;
    if (!current || !related || !current.contains(related)) {
      this.dragOverTarget.set(null);
      this.dragOverPosition.set(null);
    }
  }

  onDrop(event: DragEvent, targetItem: WatchlistItem): void {
    event.preventDefault();
    event.stopPropagation();

    const dragged = this.draggedItem();
    const position = this.dragOverPosition() || 'below';

    this.dragOverTarget.set(null);
    this.dragOverPosition.set(null);
    this.draggedItem.set(null);

    if (!dragged || dragged.symbol === targetItem.symbol) return;

    const list = [...this.watchlist()];
    const fromIndex = list.findIndex(w => w.symbol.toUpperCase() === dragged.symbol.toUpperCase());
    if (fromIndex === -1) return;

    const [movedItem] = list.splice(fromIndex, 1);
    const toIndex = list.findIndex(w => w.symbol.toUpperCase() === targetItem.symbol.toUpperCase());
    if (toIndex === -1) {
      list.push(movedItem);
    } else {
      const insertIndex = position === 'above' ? toIndex : toIndex + 1;
      list.splice(insertIndex, 0, movedItem);
    }

    this.watchlist.set(list);
    this.saveWatchlistOrder();
  }

  onDragEnd(): void {
    this.draggedItem.set(null);
    this.dragOverTarget.set(null);
    this.dragOverPosition.set(null);
  }

  refreshCurrentInstrument(): void {
    this.errorMessage.set(null);
    this.isRateLimited.set(false);
    this.loadInstrument(this.selectedSymbol());
    this.refreshWatchlistQuotes();
  }

  retryFetch(): void {
    this.errorMessage.set(null);
    this.isRateLimited.set(false);
    this.loadInstrument(this.selectedSymbol());
  }

  private refreshWatchlistQuotes(): void {
    const topSymbols = ['NIFTY 50', 'BANK NIFTY', 'RELIANCE', 'AAPL', 'EUR/USD', 'BTC/USD'];
    topSymbols.forEach((sym, idx) => {
      setTimeout(() => {
        this.marketService.getQuote(sym).pipe(
          catchError(() => of(null))
        ).subscribe(quote => {
          if (quote) {
            this.updateWatchlistItem(sym, quote.price, quote.change, quote.changePercent);
          }
        });
      }, (idx + 1) * 1500);
    });
  }

  private updateWatchlistItem(symbol: string, price: number, change: number, changePercent: string): void {
    const updated = this.watchlist().map(item => {
      if (item.symbol.toUpperCase() === symbol.toUpperCase()) {
        return { ...item, price, change, changePercent };
      }
      return item;
    });
    this.watchlist.set(updated);
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
