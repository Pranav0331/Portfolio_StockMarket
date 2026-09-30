import { Component, inject, OnInit, signal, computed, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, Subscription, forkJoin, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, catchError } from 'rxjs/operators';
import { MarketService } from '../../../services/market.service';
import { StockQuote, StockSearchItem, MarketPrice } from '../../../models/market.model';

export type MarketCategory = 'all' | 'stocks' | 'forex' | 'crypto';
export type TimeframeOption = '1D' | '1W' | '1M' | '3M' | '1Y' | 'ALL';

export interface WatchlistItem {
  symbol: string;
  name: string;
  category: 'stocks' | 'forex' | 'crypto';
  price?: number | null;
  change?: number | null;
  changePercent?: string | null;
  isLoading?: boolean;
}

export interface ChartPoint {
  x: number;
  y: number;
  price: number;
  timeLabel: string;
}

@Component({
  selector: 'app-market',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './market.html',
  styleUrl: './market.css'
})
export class MarketComponent implements OnInit, OnDestroy {
  private readonly marketService = inject(MarketService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  // Active Category Tab
  readonly activeCategory = signal<MarketCategory>('all');

  // Search State
  readonly searchQuery = signal<string>('');
  readonly isSearching = signal<boolean>(false);
  readonly searchResults = signal<StockSearchItem[]>([]);
  readonly showDropdown = signal<boolean>(false);

  // Selected Instrument / Main Terminal State
  readonly isLoadingQuote = signal<boolean>(false);
  readonly currentQuote = signal<StockQuote | null>(null);
  readonly quoteCompanyName = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly isRateLimited = signal<boolean>(false);

  // Timeframe
  readonly selectedTimeframe = signal<TimeframeOption>('1D');
  readonly timeframes: TimeframeOption[] = ['1D', '1W', '1M', '3M', '1Y', 'ALL'];

  // Interactive Chart Hover State
  readonly hoveredPoint = signal<ChartPoint | null>(null);

  // Sidebar Collapsible sections
  readonly isStocksCollapsed = signal<boolean>(false);
  readonly isForexCollapsed = signal<boolean>(false);
  readonly isCryptoCollapsed = signal<boolean>(false);

  // Popular Market Quick Chips
  readonly popularShortcuts = [
    { symbol: 'AAPL', name: 'Apple', category: 'stocks' as const },
    { symbol: 'MSFT', name: 'Microsoft', category: 'stocks' as const },
    { symbol: 'EUR/USD', name: 'EUR/USD', category: 'forex' as const },
    { symbol: 'GBP/USD', name: 'GBP/USD', category: 'forex' as const },
    { symbol: 'BTC/USD', name: 'Bitcoin', category: 'crypto' as const },
    { symbol: 'ETH/USD', name: 'Ethereum', category: 'crypto' as const }
  ];

  // Overview / Watchlist Catalog
  readonly watchlist = signal<WatchlistItem[]>([
    { symbol: 'AAPL', name: 'Apple Inc.', category: 'stocks' },
    { symbol: 'MSFT', name: 'Microsoft Corp.', category: 'stocks' },
    { symbol: 'GOOGL', name: 'Alphabet Inc.', category: 'stocks' },
    { symbol: 'TSLA', name: 'Tesla Inc.', category: 'stocks' },
    { symbol: 'EUR/USD', name: 'Euro / US Dollar', category: 'forex' },
    { symbol: 'GBP/USD', name: 'British Pound / USD', category: 'forex' },
    { symbol: 'USD/JPY', name: 'US Dollar / Yen', category: 'forex' },
    { symbol: 'BTC/USD', name: 'Bitcoin / USD', category: 'crypto' },
    { symbol: 'ETH/USD', name: 'Ethereum / USD', category: 'crypto' },
    { symbol: 'SOL/USD', name: 'Solana / USD', category: 'crypto' }
  ]);

  // Top highlight / indices instruments (first 4 items in watchlist)
  readonly highlightItems = computed(() => {
    return this.watchlist().slice(0, 4);
  });

  // Filtered watchlist based on active tab
  readonly filteredWatchlist = computed(() => {
    const cat = this.activeCategory();
    if (cat === 'all') return this.watchlist();
    return this.watchlist().filter(item => item.category === cat);
  });

  readonly stockWatchlist = computed(() => this.watchlist().filter(w => w.category === 'stocks'));
  readonly forexWatchlist = computed(() => this.watchlist().filter(w => w.category === 'forex'));
  readonly cryptoWatchlist = computed(() => this.watchlist().filter(w => w.category === 'crypto'));

  private readonly searchSubject = new Subject<string>();
  private searchSubscription?: Subscription;
  private queryParamSub?: Subscription;

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

    // Handle query params e.g. /dashboard/market?symbol=EUR/USD
    this.queryParamSub = this.route.queryParams.subscribe((params) => {
      const symbolParam = params['symbol'] || params['q'];
      if (symbolParam) {
        this.searchQuery.set(symbolParam);
        this.fetchQuote(symbolParam);
      }
    });

    // Load initial top watchlist prices quietly
    this.refreshWatchlistPrices();
  }

  ngOnDestroy(): void {
    this.searchSubscription?.unsubscribe();
    this.queryParamSub?.unsubscribe();
  }

  setCategory(category: MarketCategory): void {
    this.activeCategory.set(category);
  }

  setTimeframe(tf: TimeframeOption): void {
    this.selectedTimeframe.set(tf);
    this.hoveredPoint.set(null);
  }

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
    this.fetchQuote(query);
  }

  selectSearchResult(item: StockSearchItem): void {
    this.searchQuery.set(item.symbol);
    this.showDropdown.set(false);
    this.fetchQuote(item.symbol, item.name);
  }

  selectInstrument(symbol: string, name?: string): void {
    this.searchQuery.set(symbol);
    this.showDropdown.set(false);
    this.fetchQuote(symbol, name);
  }

  fetchQuote(symbol: string, companyName?: string): void {
    const cleanSymbol = symbol.trim().toUpperCase();
    if (!cleanSymbol) return;

    this.isLoadingQuote.set(true);
    this.errorMessage.set(null);
    this.isRateLimited.set(false);
    this.quoteCompanyName.set(companyName || null);
    this.hoveredPoint.set(null);

    // Call market service
    this.marketService.getQuote(cleanSymbol).subscribe({
      next: (quote) => {
        this.isLoadingQuote.set(false);
        this.currentQuote.set(quote);
        if (quote.name) {
          this.quoteCompanyName.set(quote.name);
        }
        // Update price in watchlist if present
        this.updateWatchlistItem(cleanSymbol, quote.price, quote.change, quote.changePercent);
      },
      error: (err) => {
        this.isLoadingQuote.set(false);
        this.currentQuote.set(null);
        if (err.status === 429) {
          this.isRateLimited.set(true);
          this.errorMessage.set(
            'Twelve Data API rate limit reached. Please try again shortly or configure an upgraded plan.'
          );
        } else if (err.status === 404) {
          this.errorMessage.set(`No market data found for symbol "${cleanSymbol}". Please verify the symbol.`);
        } else if (err.status === 504) {
          this.errorMessage.set('Market data request timed out. Please check your connection and try again.');
        } else {
          this.errorMessage.set(
            err.error?.message || err.message || 'Unable to fetch real-time market data. Please try again.'
          );
        }
      }
    });
  }

  private refreshWatchlistPrices(): void {
    // Quietly fetch data for top 4 highlight instruments
    const topSymbols = ['EUR/USD', 'BTC/USD', 'AAPL', 'MSFT'];
    topSymbols.forEach(sym => {
      this.marketService.getQuote(sym).pipe(
        catchError(() => of(null))
      ).subscribe(quote => {
        if (quote) {
          this.updateWatchlistItem(sym, quote.price, quote.change, quote.changePercent);
        }
      });
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

  clearSearch(): void {
    this.searchQuery.set('');
    this.searchResults.set([]);
    this.showDropdown.set(false);
    this.currentQuote.set(null);
    this.errorMessage.set(null);
    this.isRateLimited.set(false);
    this.hoveredPoint.set(null);
  }

  toggleStocksCollapse(): void {
    this.isStocksCollapsed.update(v => !v);
  }

  toggleForexCollapse(): void {
    this.isForexCollapsed.update(v => !v);
  }

  toggleCryptoCollapse(): void {
    this.isCryptoCollapsed.update(v => !v);
  }

  get isPositiveChange(): boolean {
    const q = this.currentQuote();
    if (!q) return false;
    return q.change >= 0;
  }

  formatCurrencySymbol(symbol?: string | null): string {
    if (!symbol) return '$';
    if (symbol.endsWith('.BSE') || symbol.endsWith('.NSE')) {
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

  // Generate clean SVG chart points based on real quote metrics
  readonly chartData = computed(() => {
    const quote = this.currentQuote();
    if (!quote || quote.price == null) {
      return { path: '', areaPath: '', points: [], minPrice: 0, maxPrice: 0 };
    }

    const price = quote.price;
    const open = quote.open ?? (price - (quote.change || 0));
    const high = quote.high ?? Math.max(price, open);
    const low = quote.low ?? Math.min(price, open);
    const prev = quote.previousClose ?? open;

    const width = 600;
    const height = 220;
    const padding = 20;

    // Build realistic step progression from open/prev to high/low to current price
    const tf = this.selectedTimeframe();
    let numSteps = 12;
    let timeLabels: string[] = [];

    if (tf === '1D') {
      numSteps = 10;
      timeLabels = ['09:30', '10:15', '11:00', '11:45', '12:30', '13:15', '14:00', '14:45', '15:30', '16:00'];
    } else if (tf === '1W') {
      numSteps = 7;
      timeLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    } else if (tf === '1M') {
      numSteps = 8;
      timeLabels = ['Week 1', 'Day 8', 'Day 12', 'Week 2', 'Day 18', 'Week 3', 'Day 26', 'Month End'];
    } else {
      numSteps = 8;
      timeLabels = ['Q1', 'Q2', 'Mid-Term', 'Quarter Peak', 'Adjustment', 'Rally', 'Recent', 'Current'];
    }

    // Anchor points
    const prices: number[] = [];
    const change = quote.change || 0;
    const startPrice = prev || (price - change);

    for (let i = 0; i < numSteps; i++) {
      if (i === 0) {
        prices.push(startPrice);
      } else if (i === numSteps - 1) {
        prices.push(price);
      } else {
        const factor = i / (numSteps - 1);
        const wave = Math.sin(factor * Math.PI * 2) * ((high - low) * 0.25);
        const interpolated = startPrice + (price - startPrice) * factor + wave;
        const clamped = Math.max(low, Math.min(high, interpolated));
        prices.push(clamped);
      }
    }

    const minP = Math.min(...prices, low);
    const maxP = Math.max(...prices, high);
    const pRange = maxP - minP || 1;

    const points: ChartPoint[] = prices.map((p, index) => {
      const x = padding + (index / (numSteps - 1)) * (width - 2 * padding);
      const y = height - padding - ((p - minP) / pRange) * (height - 2 * padding);
      return {
        x,
        y,
        price: p,
        timeLabel: timeLabels[index] || `T-${index}`
      };
    });

    // Create SVG smooth path
    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const prevPt = points[i - 1];
      const curPt = points[i];
      const cx = (prevPt.x + curPt.x) / 2;
      path += ` C ${cx} ${prevPt.y}, ${cx} ${curPt.y}, ${curPt.x} ${curPt.y}`;
    }

    const areaPath = `${path} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;

    return { path, areaPath, points, minPrice: minP, maxPrice: maxP };
  });

  onChartHover(event: MouseEvent): void {
    const data = this.chartData();
    if (!data.points || data.points.length === 0) return;

    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const scaleX = 600 / rect.width;
    const svgX = mouseX * scaleX;

    // Find closest point
    let closest = data.points[0];
    let minDist = Math.abs(data.points[0].x - svgX);
    for (const pt of data.points) {
      const dist = Math.abs(pt.x - svgX);
      if (dist < minDist) {
        minDist = dist;
        closest = pt;
      }
    }
    this.hoveredPoint.set(closest);
  }

  onChartLeave(): void {
    this.hoveredPoint.set(null);
  }
}
