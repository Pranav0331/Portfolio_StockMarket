import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription, forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { MarketService } from '../../../services/market.service';
import { FundamentalData, StockQuote } from '../../../models/market.model';

@Component({
  selector: 'app-fundamental',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './fundamental.html',
  styleUrls: ['./fundamental.css']
})
export class FundamentalComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly marketService = inject(MarketService);

  readonly symbol = signal<string>('AAPL');
  readonly fundamentalData = signal<FundamentalData | null>(null);
  readonly currentQuote = signal<StockQuote | null>(null);
  readonly isLoading = signal<boolean>(true);
  readonly errorMessage = signal<string | null>(null);
  readonly searchQuery = signal<string>('');

  private routeSub?: Subscription;

  ngOnInit(): void {
    this.routeSub = this.route.paramMap.subscribe(params => {
      const sym = params.get('symbol');
      if (sym && sym.trim().length > 0) {
        this.symbol.set(sym.trim().toUpperCase());
        this.searchQuery.set(this.symbol());
        this.loadFundamentalData(this.symbol());
      } else {
        this.symbol.set('AAPL');
        this.searchQuery.set('AAPL');
        this.loadFundamentalData('AAPL');
      }
    });
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
  }

  loadFundamentalData(sym: string): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    forkJoin({
      fundamentals: this.marketService.getFundamentals(sym).pipe(
        catchError(err => {
          const msg = err.error?.message || err.message || 'Failed to fetch fundamental metrics';
          this.errorMessage.set(msg);
          return of(null);
        })
      ),
      quote: this.marketService.getQuote(sym).pipe(
        catchError(() => of(null))
      )
    }).subscribe({
      next: ({ fundamentals, quote }) => {
        this.isLoading.set(false);
        this.fundamentalData.set(fundamentals);
        this.currentQuote.set(quote);
      },
      error: err => {
        this.isLoading.set(false);
        this.errorMessage.set(err.error?.message || 'Error communicating with market data service');
      }
    });
  }

  onSearchInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchQuery.set(input.value);
  }

  onSearchEnter(): void {
    const target = this.searchQuery().trim().toUpperCase();
    if (target.length > 0 && target !== this.symbol()) {
      this.router.navigate(['/dashboard/fundamental', target]);
    }
  }

  refreshData(): void {
    this.loadFundamentalData(this.symbol());
  }

  getCurrencySymbol(currency?: string | null): string {
    const cur = currency || this.fundamentalData()?.currency || 'USD';
    if (cur === 'INR') return '₹';
    if (cur === 'EUR') return '€';
    if (cur === 'GBP') return '£';
    return '$';
  }

  formatLargeNumber(val?: number | null, currency?: string | null): string {
    if (val === null || val === undefined || isNaN(val)) {
      return 'Data unavailable';
    }
    const curSymbol = this.getCurrencySymbol(currency);
    const abs = Math.abs(val);
    if (abs >= 1e12) {
      return `${curSymbol}${(val / 1e12).toFixed(2)}T`;
    }
    if (abs >= 1e9) {
      return `${curSymbol}${(val / 1e9).toFixed(2)}B`;
    }
    if (abs >= 1e6) {
      return `${curSymbol}${(val / 1e6).toFixed(2)}M`;
    }
    if (abs >= 1e3) {
      return `${curSymbol}${(val / 1e3).toFixed(2)}K`;
    }
    return `${curSymbol}${val.toFixed(2)}`;
  }

  formatRatio(val?: number | null, suffix: string = ''): string {
    if (val === null || val === undefined || isNaN(val)) {
      return 'Data unavailable';
    }
    return `${val.toFixed(2)}${suffix}`;
  }

  formatPercent(val?: number | null): string {
    if (val === null || val === undefined || isNaN(val)) {
      return 'Data unavailable';
    }
    // If dividend yield is decimal (e.g. 0.0032), format as 0.32%
    const pct = val < 1 && val > -1 ? val * 100 : val;
    return `${pct.toFixed(2)}%`;
  }
}
