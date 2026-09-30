import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
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

  it('should render empty market terminal state initially', async () => {
    const fixture = TestBed.createComponent(MarketComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.empty-state-card')).toBeTruthy();
    expect(compiled.querySelector('.empty-state-title')?.textContent).toContain('Explore Global Markets');
    expect(compiled.querySelector('#market-terminal-search-input')).toBeTruthy();
  });

  it('should fetch and display active instrument terminal when search is submitted', async () => {
    const mockQuote: StockQuote = {
      symbol: 'AAPL',
      name: 'Apple Inc.',
      price: 185.5,
      change: 2.2,
      changePercent: '+1.20%',
      previousClose: 183.3,
      open: 184.0,
      high: 186.0,
      low: 183.5,
      volume: 45000000,
      latestTradingDay: '2026-09-28',
      timestamp: 1727500000
    };

    vi.spyOn(marketService, 'getQuote').mockReturnValue(of(mockQuote));

    const fixture = TestBed.createComponent(MarketComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.searchQuery.set('AAPL');
    component.onSearchSubmit();
    fixture.detectChanges();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.active-instrument-card')).toBeTruthy();
    expect(compiled.querySelector('.instrument-badge')?.textContent).toContain('AAPL');
    expect(compiled.querySelector('.primary-price')?.textContent).toContain('185.50');
    expect(compiled.querySelector('.price-change-pill')?.textContent).toContain('+2.20');
    expect(compiled.querySelector('.terminal-svg-chart')).toBeTruthy();
    expect(compiled.querySelector('.key-metrics-grid')).toBeTruthy();
  });

  it('should switch category tabs correctly', () => {
    const fixture = TestBed.createComponent(MarketComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.activeCategory()).toBe('all');
    component.setCategory('forex');
    expect(component.activeCategory()).toBe('forex');
    component.setCategory('crypto');
    expect(component.activeCategory()).toBe('crypto');
  });

  it('should switch chart timeframes correctly', () => {
    const fixture = TestBed.createComponent(MarketComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.selectedTimeframe()).toBe('1D');
    component.setTimeframe('1M');
    expect(component.selectedTimeframe()).toBe('1M');
    component.setTimeframe('1Y');
    expect(component.selectedTimeframe()).toBe('1Y');
  });

  it('should display rate limit error card when 429 is returned', async () => {
    vi.spyOn(marketService, 'getQuote').mockReturnValue(
      throwError(() => ({ status: 429, message: 'Too Many Requests' }))
    );

    const fixture = TestBed.createComponent(MarketComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.fetchQuote('BTC/USD');
    fixture.detectChanges();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.rate-limit-card')).toBeTruthy();
    expect(compiled.querySelector('.error-title')?.textContent).toContain('Rate Limit Notice');
  });

  it('should display loading skeleton when quote is being fetched', () => {
    vi.spyOn(marketService, 'getQuote').mockReturnValue(of({} as StockQuote));

    const fixture = TestBed.createComponent(MarketComponent);
    const component = fixture.componentInstance;
    component.isLoadingQuote.set(true);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.skeleton-card')).toBeTruthy();
  });
});
