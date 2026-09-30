import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { of, throwError, BehaviorSubject } from 'rxjs';
import { StockDetailsComponent } from './stock-details';
import { MarketService } from '../../../services/market.service';
import { StockQuote, CandleSeries } from '../../../models/market.model';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Polyfills for JSDOM headless environment
if (typeof window !== 'undefined') {
  if (!window.matchMedia) {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    }));
  }

  if (!window.ResizeObserver) {
    window.ResizeObserver = class {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    } as any;
  }

  HTMLCanvasElement.prototype.getContext = vi.fn().mockImplementation(() => ({
    fillRect: vi.fn(),
    clearRect: vi.fn(),
    getImageData: vi.fn(() => ({ data: new Array(4) })),
    putImageData: vi.fn(),
    createImageData: vi.fn(() => []),
    setTransform: vi.fn(),
    drawImage: vi.fn(),
    save: vi.fn(),
    fillText: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    stroke: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    rotate: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    measureText: vi.fn(() => ({ width: 0 })),
    transform: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn()
  })) as any;
}

describe('StockDetailsComponent', () => {
  let marketService: MarketService;
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
    latestTradingDay: '2026-09-30',
    timestamp: 1727690000
  };

  const mockRelianceCandles: CandleSeries = {
    symbol: 'RELIANCE',
    interval: '5min',
    currency: 'INR',
    exchange: 'NSE',
    type: 'Stock',
    candles: [
      {
        timestamp: 1727690000,
        datetime: '2026-09-30 09:15:00',
        open: 2920.0,
        high: 2935.0,
        low: 2918.0,
        close: 2930.0,
        volume: 120000
      },
      {
        timestamp: 1727690300,
        datetime: '2026-09-30 09:20:00',
        open: 2930.0,
        high: 2945.0,
        low: 2928.0,
        close: 2940.0,
        volume: 150000
      }
    ]
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
    latestTradingDay: '2026-09-30',
    timestamp: 1727690000
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StockDetailsComponent],
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
  });

  it('should create the StockDetailsComponent', () => {
    vi.spyOn(marketService, 'getQuote').mockReturnValue(of(mockRelianceQuote));
    vi.spyOn(marketService, 'getCandles').mockReturnValue(of(mockRelianceCandles));

    const fixture = TestBed.createComponent(StockDetailsComponent);
    const component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });

  it('should load real Reliance data from route parameters and identify Upstox provider', () => {
    paramMap$.next({ get: (k: string) => (k === 'symbol' ? 'RELIANCE' : null) });
    vi.spyOn(marketService, 'getQuote').mockReturnValue(of(mockRelianceQuote));
    vi.spyOn(marketService, 'getCandles').mockReturnValue(of(mockRelianceCandles));

    const fixture = TestBed.createComponent(StockDetailsComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.symbol()).toBe('RELIANCE');
    expect(component.currentProvider()).toBe('Upstox');
    expect(component.currentQuote()?.price).toBe(2950.5);
    expect(component.candleData().length).toBe(2);
  });

  it('should load US stock data (AAPL) and identify Twelve Data provider', () => {
    paramMap$.next({ get: (k: string) => (k === 'symbol' ? 'AAPL' : null) });
    vi.spyOn(marketService, 'getQuote').mockReturnValue(of(mockAaplQuote));
    vi.spyOn(marketService, 'getCandles').mockReturnValue(of({ ...mockRelianceCandles, symbol: 'AAPL' }));

    const fixture = TestBed.createComponent(StockDetailsComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.symbol()).toBe('AAPL');
    expect(component.currentProvider()).toBe('Twelve Data');
    expect(component.currentQuote()?.name).toBe('Apple Inc.');
  });

  it('should switch timeframes and request correct interval and outputsize', () => {
    paramMap$.next({ get: (k: string) => (k === 'symbol' ? 'RELIANCE' : null) });
    vi.spyOn(marketService, 'getQuote').mockReturnValue(of(mockRelianceQuote));
    const candlesSpy = vi.spyOn(marketService, 'getCandles').mockReturnValue(of(mockRelianceCandles));

    const fixture = TestBed.createComponent(StockDetailsComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.setTimeframe('1M');
    expect(component.currentTimeframe()).toBe('1M');
    expect(candlesSpy).toHaveBeenCalledWith('RELIANCE', '1h', 160);

    component.setTimeframe('1Y');
    expect(component.currentTimeframe()).toBe('1Y');
    expect(candlesSpy).toHaveBeenCalledWith('RELIANCE', '1day', 365);
  });

  it('should switch chart type between candles, line, and area', () => {
    paramMap$.next({ get: (k: string) => (k === 'symbol' ? 'RELIANCE' : null) });
    vi.spyOn(marketService, 'getQuote').mockReturnValue(of(mockRelianceQuote));
    vi.spyOn(marketService, 'getCandles').mockReturnValue(of(mockRelianceCandles));

    const fixture = TestBed.createComponent(StockDetailsComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.setChartType('line');
    expect(component.currentChartType()).toBe('line');

    component.setChartType('area');
    expect(component.currentChartType()).toBe('area');

    component.setChartType('candles');
    expect(component.currentChartType()).toBe('candles');
  });

  it('should handle 429 rate limit error gracefully', () => {
    paramMap$.next({ get: (k: string) => (k === 'symbol' ? 'RELIANCE' : null) });
    vi.spyOn(marketService, 'getQuote').mockReturnValue(throwError(() => ({ status: 429 })));
    vi.spyOn(marketService, 'getCandles').mockReturnValue(throwError(() => ({ status: 429 })));

    const fixture = TestBed.createComponent(StockDetailsComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.isRateLimited()).toBe(true);
    expect(component.errorMessage()).toContain('rate limit');
  });

  it('should handle 404 or missing data by displaying "Data unavailable"', () => {
    paramMap$.next({ get: (k: string) => (k === 'symbol' ? 'UNKNOWN' : null) });
    vi.spyOn(marketService, 'getQuote').mockReturnValue(throwError(() => ({ status: 404 })));
    vi.spyOn(marketService, 'getCandles').mockReturnValue(throwError(() => ({ status: 404 })));

    const fixture = TestBed.createComponent(StockDetailsComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.errorMessage()).toBe('Data unavailable');
    expect(component.candleData()).toEqual([]);
  });

  it('should correctly format currency symbols for Indian, US, Forex, and Crypto', () => {
    const fixture = TestBed.createComponent(StockDetailsComponent);
    const component = fixture.componentInstance;

    expect(component.formatCurrencySymbol('RELIANCE')).toBe('₹');
    expect(component.formatCurrencySymbol('NIFTY 50')).toBe('₹');
    expect(component.formatCurrencySymbol('AAPL')).toBe('$');
    expect(component.formatCurrencySymbol('EUR/USD')).toBe('$');
    expect(component.formatCurrencySymbol('BTC/USD')).toBe('$');
  });

  it('should calculate day range percentage correctly', () => {
    const fixture = TestBed.createComponent(StockDetailsComponent);
    const component = fixture.componentInstance;

    const quote: StockQuote = {
      symbol: 'RELIANCE',
      price: 2950,
      change: 0,
      changePercent: '0%',
      low: 2900,
      high: 3000
    };

    expect(component.getDayProgressPercent(quote)).toBe(50);
  });
});
