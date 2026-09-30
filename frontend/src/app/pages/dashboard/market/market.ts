import { Component, inject, OnInit, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { MarketService } from '../../../services/market.service';
import { StockQuote, StockSearchItem } from '../../../models/market.model';

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

  readonly searchQuery = signal<string>('');
  readonly isSearching = signal<boolean>(false);
  readonly isLoadingQuote = signal<boolean>(false);
  readonly searchResults = signal<StockSearchItem[]>([]);
  readonly currentQuote = signal<StockQuote | null>(null);
  readonly quoteCompanyName = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly isRateLimited = signal<boolean>(false);
  readonly showDropdown = signal<boolean>(false);

  // Popular tickers across Stocks, Forex, and Crypto
  readonly quickTickers = [
    { symbol: 'EUR/USD', name: 'Euro / US Dollar' },
    { symbol: 'BTC/USD', name: 'Bitcoin / USD' },
    { symbol: 'AAPL', name: 'Apple Inc.' },
    { symbol: 'MSFT', name: 'Microsoft Corp.' },
    { symbol: 'GOOGL', name: 'Alphabet Inc.' },
    { symbol: 'ETH/USD', name: 'Ethereum / USD' },
    { symbol: 'GBP/USD', name: 'British Pound / USD' },
    { symbol: 'TSLA', name: 'Tesla Inc.' }
  ];

  private readonly searchSubject = new Subject<string>();
  private searchSubscription?: Subscription;
  private queryParamSub?: Subscription;

  ngOnInit(): void {
    // Setup debounced search for keyword suggestions
    this.searchSubscription = this.searchSubject.pipe(
      debounceTime(350),
      distinctUntilChanged(),
      switchMap((keywords) => {
        if (!keywords || keywords.trim().length < 2) {
          this.isSearching.set(false);
          this.searchResults.set([]);
          this.showDropdown.set(false);
          return [];
        }
        this.isSearching.set(true);
        return this.marketService.searchSymbols(keywords);
      })
    ).subscribe({
      next: (res) => {
        this.isSearching.set(false);
        if (res && res.bestMatches) {
          this.searchResults.set(res.bestMatches);
          this.showDropdown.set(res.bestMatches.length > 0);
        } else {
          this.searchResults.set([]);
          this.showDropdown.set(false);
        }
      },
      error: () => {
        this.isSearching.set(false);
        this.searchResults.set([]);
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
  }

  ngOnDestroy(): void {
    this.searchSubscription?.unsubscribe();
    this.queryParamSub?.unsubscribe();
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

  selectQuickTicker(ticker: { symbol: string; name: string }): void {
    this.searchQuery.set(ticker.symbol);
    this.showDropdown.set(false);
    this.fetchQuote(ticker.symbol, ticker.name);
  }

  fetchQuote(symbol: string, companyName?: string): void {
    const cleanSymbol = symbol.trim().toUpperCase();
    if (!cleanSymbol) return;

    this.isLoadingQuote.set(true);
    this.errorMessage.set(null);
    this.isRateLimited.set(false);
    this.quoteCompanyName.set(companyName || null);

    this.marketService.getQuote(cleanSymbol).subscribe({
      next: (quote) => {
        this.isLoadingQuote.set(false);
        this.currentQuote.set(quote);
        if (quote.name) {
          this.quoteCompanyName.set(quote.name);
        }
      },
      error: (err) => {
        this.isLoadingQuote.set(false);
        this.currentQuote.set(null);
        if (err.status === 429) {
          this.isRateLimited.set(true);
          this.errorMessage.set(
            'Twelve Data API rate limit reached. Please try again shortly or configure an upgraded API key.'
          );
        } else if (err.status === 404) {
          this.errorMessage.set(`No market quote found for symbol "${cleanSymbol}". Please verify the ticker symbol.`);
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

  clearSearch(): void {
    this.searchQuery.set('');
    this.searchResults.set([]);
    this.showDropdown.set(false);
    this.currentQuote.set(null);
    this.errorMessage.set(null);
    this.isRateLimited.set(false);
  }

  get isPositiveChange(): boolean {
    const q = this.currentQuote();
    if (!q) return false;
    return q.change >= 0;
  }

  formatCurrencySymbol(symbol: string): string {
    if (symbol.endsWith('.BSE') || symbol.endsWith('.NSE')) {
      return '₹';
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
