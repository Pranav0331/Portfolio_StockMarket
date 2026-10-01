import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, ActivatedRoute, Router } from '@angular/router';
import { of, throwError, BehaviorSubject } from 'rxjs';
import { TechnicalAnalysisComponent } from './technical';
import { MarketService } from '../../../services/market.service';
import { StockQuote, CandleSeries } from '../../../models/market.model';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Polyfills for headless testing environment
if (typeof window !== 'undefined') {
  if (!window.ResizeObserver) {
    window.ResizeObserver = class {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    } as any;
  }
}

describe('TechnicalAnalysisComponent', () => {
  let marketService: MarketService;
  let router: Router;

  const paramMap$ = new BehaviorSubject<{ get: (k: string) => string | null }>({
    get: (k: string) => (k === 'symbol' ? 'RELIANCE' : null)
  });

  const mockRelianceQuote: StockQuote = {
    symbol: 'RELIANCE',
    name: 'Reliance Industries Ltd',
    price: 2950.5,
    change: 32.4,
    changePercent: '+1.11%',
    previousClose: 2918.1,
    open: 2920.0,
    high: 2965.0,
    low: 2915.0,
    volume: 5420000,
    latestTradingDay: '2026-10-01',
    timestamp: 1727750000
  };

  // Generate 60 realistic candles for testing
  const mockRelianceCandles: CandleSeries = {
    symbol: 'RELIANCE',
    interval: '5min',
    currency: 'INR',
    exchange: 'NSE',
    type: 'Stock',
    candles: Array.from({ length: 60 }, (_, i) => ({
      timestamp: 1727750000 + i * 300,
      datetime: `2026-10-01 09:${i < 10 ? '0' + i : i}:00`,
      open: 2900 + i * 1.5,
      high: 2905 + i * 1.5,
      low: 2898 + i * 1.5,
      close: 2902 + i * 1.5,
      volume: 15000 + i * 100
    }))
  };

  const mockAaplQuote: StockQuote = {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    price: 228.5,
    change: -1.8,
    changePercent: '-0.78%',
    previousClose: 230.3,
    open: 229.0,
    high: 231.0,
    low: 227.5,
    volume: 42000000,
    latestTradingDay: '2026-10-01',
    timestamp: 1727750000
  };

  const mockAaplCandles: CandleSeries = {
    symbol: 'AAPL',
    interval: '5min',
    currency: 'USD',
    exchange: 'NASDAQ',
    type: 'Stock',
    candles: Array.from({ length: 60 }, (_, i) => ({
      timestamp: 1727750000 + i * 300,
      datetime: `2026-10-01 09:${i < 10 ? '0' + i : i}:00`,
      open: 220 + i * 0.2,
      high: 222 + i * 0.2,
      low: 219 + i * 0.2,
      close: 221 + i * 0.2,
      volume: 80000 + i * 200
    }))
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TechnicalAnalysisComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: paramMap$.asObservable()
          }
        }
      ]
    }).compileComponents();

    marketService = TestBed.inject(MarketService);
    router = TestBed.inject(Router);
  });

  it('should create TechnicalAnalysisComponent and calculate indicators on init', () => {
    vi.spyOn(marketService, 'getQuote').mockReturnValue(of(mockRelianceQuote));
    const candlesSpy = vi.spyOn(marketService, 'getCandles').mockReturnValue(of(mockRelianceCandles));

    const fixture = TestBed.createComponent(TechnicalAnalysisComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component).toBeTruthy();
    expect(candlesSpy).toHaveBeenCalledWith('RELIANCE', '5min', 75);
    expect(component.symbol()).toBe('RELIANCE');
    expect(component.currentProvider()).toBe('Upstox');

    const summary = component.summary();
    expect(summary).not.toBeNull();
    expect(summary?.sma20.isSufficient).toBe(true);
    expect(summary?.ema20.isSufficient).toBe(true);
    expect(summary?.rsi14.isSufficient).toBe(true);
    expect(summary?.macd.isSufficient).toBe(true);
  });

  it('should route US instruments to Twelve Data provider and compute technical values', () => {
    paramMap$.next({ get: (k: string) => (k === 'symbol' ? 'AAPL' : null) });
    vi.spyOn(marketService, 'getQuote').mockReturnValue(of(mockAaplQuote));
    vi.spyOn(marketService, 'getCandles').mockReturnValue(of(mockAaplCandles));

    const fixture = TestBed.createComponent(TechnicalAnalysisComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.symbol()).toBe('AAPL');
    expect(component.currentProvider()).toBe('Twelve Data');
    expect(component.summary()?.rsi14.isSufficient).toBe(true);
  });

  it('should switch timeframe and request corresponding interval & outputsize', () => {
    paramMap$.next({ get: (k: string) => (k === 'symbol' ? 'RELIANCE' : null) });
    vi.spyOn(marketService, 'getQuote').mockReturnValue(of(mockRelianceQuote));
    const candlesSpy = vi.spyOn(marketService, 'getCandles').mockReturnValue(of(mockRelianceCandles));

    const fixture = TestBed.createComponent(TechnicalAnalysisComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.setTimeframe('1M');
    expect(component.currentTimeframe()).toBe('1M');
    expect(candlesSpy).toHaveBeenCalledWith('RELIANCE', '1h', 160);

    component.setTimeframe('1Y');
    expect(component.currentTimeframe()).toBe('1Y');
    expect(candlesSpy).toHaveBeenCalledWith('RELIANCE', '1day', 365);
  });

  it('should toggle indicator overlays and sub-charts', () => {
    const fixture = TestBed.createComponent(TechnicalAnalysisComponent);
    const component = fixture.componentInstance;

    expect(component.showEMA()).toBe(true);
    component.toggleEMA();
    expect(component.showEMA()).toBe(false);

    expect(component.showSMA()).toBe(true);
    component.toggleSMA();
    expect(component.showSMA()).toBe(false);

    expect(component.showRSI()).toBe(true);
    component.toggleRSI();
    expect(component.showRSI()).toBe(false);

    expect(component.showMACD()).toBe(true);
    component.toggleMACD();
    expect(component.showMACD()).toBe(false);
  });

  it('should handle insufficient historical data safely', () => {
    paramMap$.next({ get: (k: string) => (k === 'symbol' ? 'RELIANCE' : null) });
    vi.spyOn(marketService, 'getQuote').mockReturnValue(of(mockRelianceQuote));
    // Provide only 5 candles (insufficient for 14-period RSI, 20-period SMA, 26-period MACD)
    vi.spyOn(marketService, 'getCandles').mockReturnValue(of({
      ...mockRelianceCandles,
      candles: mockRelianceCandles.candles.slice(0, 5)
    }));

    const fixture = TestBed.createComponent(TechnicalAnalysisComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    const summary = component.summary();
    expect(summary?.sma20.isSufficient).toBe(false);
    expect(summary?.sma20.latestValue).toBeNull();
    expect(summary?.rsi14.isSufficient).toBe(false);
    expect(summary?.macd.isSufficient).toBe(false);
  });

  it('should handle API error when candle fetch fails', () => {
    paramMap$.next({ get: (k: string) => (k === 'symbol' ? 'UNKNOWN' : null) });
    vi.spyOn(marketService, 'getQuote').mockReturnValue(
      throwError(() => ({ error: { message: 'Symbol not found' } }))
    );
    vi.spyOn(marketService, 'getCandles').mockReturnValue(
      throwError(() => ({ error: { message: 'Symbol not found' } }))
    );

    const fixture = TestBed.createComponent(TechnicalAnalysisComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.errorMessage()).toBe('Symbol not found');
  });

  it('should navigate to new symbol on search enter', () => {
    const navigateSpy = vi.spyOn(router, 'navigate');

    const fixture = TestBed.createComponent(TechnicalAnalysisComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.searchQuery.set('TCS');
    component.onSearchEnter();

    expect(navigateSpy).toHaveBeenCalledWith(['/dashboard/technical', 'TCS']);
    expect(component.searchQuery()).toBe('');
  });
});
