import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FundamentalComponent } from './fundamental';
import { MarketService } from '../../../services/market.service';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { of, throwError, BehaviorSubject } from 'rxjs';
import { FundamentalData, StockQuote } from '../../../models/market.model';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('FundamentalComponent', () => {
  let component: FundamentalComponent;
  let fixture: ComponentFixture<FundamentalComponent>;
  let marketService: MarketService;
  let router: Router;
  let paramMap$: BehaviorSubject<any>;

  const mockAaplFundamentals: FundamentalData = {
    symbol: 'AAPL',
    companyName: 'Apple Inc.',
    exchange: 'NASDAQ',
    currency: 'USD',
    provider: 'Twelve Data',
    sector: 'Technology',
    industry: 'Consumer Electronics',
    description: 'Apple Inc. designs, manufactures, and markets smartphones...',
    ceo: 'Mr. Tim Cook',
    website: 'https://www.apple.com',
    marketCap: 3000000000000,
    peRatio: 30.5,
    eps: 6.42,
    roe: 1.45,
    revenue: 383285000000,
    netIncome: 96995000000,
    dividendYield: 0.0055,
    fiftyTwoWeekHigh: 237.23,
    fiftyTwoWeekLow: 164.08,
    lastUpdated: 1727690000
  };

  const mockRelianceFundamentals: FundamentalData = {
    symbol: 'RELIANCE',
    companyName: 'Reliance Industries Ltd',
    exchange: 'NSE',
    currency: 'INR',
    provider: 'Upstox',
    sector: null,
    industry: null,
    description: null,
    ceo: null,
    website: null,
    marketCap: null,
    peRatio: null,
    eps: null,
    roe: null,
    revenue: null,
    netIncome: null,
    dividendYield: null,
    fiftyTwoWeekHigh: null,
    fiftyTwoWeekLow: null,
    lastUpdated: 1727690000
  };

  const mockQuote: StockQuote = {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    price: 220.5,
    change: 2.3,
    changePercent: '+1.05%',
    previousClose: 218.2,
    open: 219.0,
    high: 221.0,
    low: 218.5,
    volume: 50000000,
    latestTradingDay: '2026-09-30',
    timestamp: 1727690000
  };

  beforeEach(async () => {
    paramMap$ = new BehaviorSubject({ get: (key: string) => (key === 'symbol' ? 'AAPL' : null) });

    await TestBed.configureTestingModule({
      imports: [FundamentalComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { paramMap: paramMap$.asObservable() }
        },
        {
          provide: MarketService,
          useValue: {
            getFundamentals: vi.fn().mockReturnValue(of(mockAaplFundamentals)),
            getQuote: vi.fn().mockReturnValue(of(mockQuote)),
            isIndianSymbol: vi.fn().mockImplementation((sym: string) => sym === 'RELIANCE')
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(FundamentalComponent);
    component = fixture.componentInstance;
    marketService = TestBed.inject(MarketService);
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  it('1. should create FundamentalComponent and load AAPL metrics', () => {
    expect(component).toBeTruthy();
    expect(component.symbol()).toBe('AAPL');
    expect(component.fundamentalData()).toEqual(mockAaplFundamentals);
    expect(component.isLoading()).toBe(false);
  });

  it('2. should correctly format large currency numbers and ratios', () => {
    expect(component.formatLargeNumber(3000000000000, 'USD')).toBe('$3.00T');
    expect(component.formatLargeNumber(5000000000, 'USD')).toBe('$5.00B');
    expect(component.formatLargeNumber(50000000, 'USD')).toBe('$50.00M');
    expect(component.formatLargeNumber(null, 'USD')).toBe('Data unavailable');
    expect(component.formatRatio(30.5, 'x')).toBe('30.50x');
    expect(component.formatRatio(null)).toBe('Data unavailable');
    expect(component.formatPercent(0.0055)).toBe('0.55%');
    expect(component.formatPercent(null)).toBe('Data unavailable');
  });

  it('3. should render Data unavailable for missing Upstox balance sheet metrics', () => {
    paramMap$.next({ get: (key: string) => (key === 'symbol' ? 'RELIANCE' : null) });
    vi.spyOn(marketService, 'getFundamentals').mockReturnValue(of(mockRelianceFundamentals));

    component.loadFundamentalData('RELIANCE');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(component.symbol()).toBe('RELIANCE');
    expect(component.fundamentalData()?.marketCap).toBeNull();
    expect(compiled.textContent).toContain('Data unavailable');
  });

  it('4. should handle API error when fundamental fetch fails', () => {
    vi.spyOn(marketService, 'getFundamentals').mockReturnValue(
      throwError(() => ({ error: { message: 'Symbol not found' } }))
    );

    component.loadFundamentalData('UNKNOWN');
    fixture.detectChanges();

    expect(component.errorMessage()).toBe('Symbol not found');
  });

  it('5. should navigate to new symbol on search enter', () => {
    const navigateSpy = vi.spyOn(router, 'navigate');

    component.searchQuery.set('TSLA');
    component.onSearchEnter();

    expect(navigateSpy).toHaveBeenCalledWith(['/dashboard/fundamental', 'TSLA']);
  });
});
