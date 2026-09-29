import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { of, throwError } from 'rxjs';
import { MarketComponent } from './market';
import { MarketService } from '../../../services/market.service';
import { StockQuote, StockSearchResponse } from '../../../models/market.model';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('MarketComponent', () => {
  let marketService: MarketService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MarketComponent],
      providers: [
        MarketService,
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([])
      ]
    }).compileComponents();

    marketService = TestBed.inject(MarketService);
  });

  it('should create MarketComponent', () => {
    const fixture = TestBed.createComponent(MarketComponent);
    const component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });

  it('should render empty market telemetry state initially', async () => {
    const fixture = TestBed.createComponent(MarketComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.empty-market-panel')).toBeTruthy();
    expect(compiled.querySelector('.empty-title')?.textContent).toContain('Ready for Live Market Exploration');
    expect(compiled.querySelector('#stock-market-search-input')).toBeTruthy();
  });

  it('should fetch and display stock quote card when search is submitted', async () => {
    const mockQuote: StockQuote = {
      symbol: 'RELIANCE.BSE',
      name: 'Reliance Industries Limited',
      price: 2980.5,
      change: 15.2,
      changePercent: '+0.51%',
      previousClose: 2965.3,
      open: 2970.0,
      high: 2995.0,
      low: 2960.0,
      volume: 1250000,
      latestTradingDay: '2026-09-28'
    };

    vi.spyOn(marketService, 'getQuote').mockReturnValue(of(mockQuote));

    const fixture = TestBed.createComponent(MarketComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.searchQuery.set('RELIANCE.BSE');
    component.onSearchSubmit();
    fixture.detectChanges();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.quote-card')).toBeTruthy();
    expect(compiled.querySelector('.symbol-badge')?.textContent).toContain('RELIANCE.BSE');
    expect(compiled.querySelector('.price-value')?.textContent).toContain('2,980.50');
    expect(compiled.querySelector('.change-badge')?.textContent).toContain('+15.20');
    expect(compiled.querySelector('.quote-stats-grid')).toBeTruthy();
  });

  it('should display rate limit error panel when 429 is returned', async () => {
    vi.spyOn(marketService, 'getQuote').mockReturnValue(
      throwError(() => ({ status: 429, message: 'Too Many Requests' }))
    );

    const fixture = TestBed.createComponent(MarketComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.fetchQuote('IBM');
    fixture.detectChanges();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.rate-limit-panel')).toBeTruthy();
    expect(compiled.querySelector('.error-title')?.textContent).toContain('Market Rate Limit Notice');
  });

  it('should display loading skeleton when quote is being fetched', () => {
    // Return an observable that doesn't immediately complete
    vi.spyOn(marketService, 'getQuote').mockReturnValue(of({} as StockQuote));

    const fixture = TestBed.createComponent(MarketComponent);
    const component = fixture.componentInstance;
    component.isLoadingQuote.set(true);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.skeleton-card')).toBeTruthy();
  });
});
