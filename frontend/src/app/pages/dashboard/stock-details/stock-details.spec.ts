import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { of, throwError, BehaviorSubject } from 'rxjs';
import { StockDetailsComponent } from './stock-details';
import { MarketService } from '../../../services/market.service';
import { AuthService } from '../../../services/auth.service';
import { TradingService } from '../../../services/trading.service';
import { StockQuote, CandleSeries } from '../../../models/market.model';
import { TradeResponse, VirtualWallet, UserHolding } from '../../../models/trading.model';
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
  let authService: AuthService;
  let tradingService: TradingService;

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

  const mockWallet: VirtualWallet = {
    cashBalance: 100000,
    totalInvested: 0,
    totalPortfolioValue: 100000,
    currency: 'USD'
  };

  const mockHolding: UserHolding = {
    holdingId: 1,
    symbol: 'RELIANCE',
    companyName: 'Reliance Industries Ltd',
    exchange: 'NSE',
    currency: 'INR',
    quantity: 10,
    averageBuyPrice: 2900,
    totalInvested: 29000,
    currentPrice: 2950.5,
    currentValue: 29505,
    unrealizedPnL: 505,
    unrealizedPnLPercent: 1.74
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
    authService = TestBed.inject(AuthService);
    tradingService = TestBed.inject(TradingService);
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

  it('should handle simulated BUY trade execution', () => {
    paramMap$.next({ get: (k: string) => (k === 'symbol' ? 'RELIANCE' : null) });
    vi.spyOn(marketService, 'getQuote').mockReturnValue(of(mockRelianceQuote));
    vi.spyOn(marketService, 'getCandles').mockReturnValue(of(mockRelianceCandles));
    vi.spyOn(authService, 'isAuthenticated').mockReturnValue(true);

    const mockTradeRes: TradeResponse = {
      orderId: 101,
      transactionId: 201,
      symbol: 'RELIANCE',
      companyName: 'Reliance Industries Ltd',
      orderType: 'BUY',
      orderStatus: 'EXECUTED',
      quantity: 5,
      executionPrice: 2950.5,
      totalAmount: 14752.5,
      remainingCashBalance: 85247.5,
      currentHoldingQuantity: 5,
      executedAt: '2026-10-01T03:00:00Z',
      message: 'Successfully bought 5 shares of RELIANCE'
    };

    const buySpy = vi.spyOn(tradingService, 'buy').mockReturnValue(of(mockTradeRes));
    vi.spyOn(tradingService, 'getWallet').mockReturnValue(of(mockWallet));
    vi.spyOn(tradingService, 'getHoldingForSymbol').mockReturnValue(of(mockHolding));

    const fixture = TestBed.createComponent(StockDetailsComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.setTradeType('BUY');
    component.setTradeQuantity(5);
    component.submitTrade();

    expect(buySpy).toHaveBeenCalledWith({ symbol: 'RELIANCE', quantity: 5 });
    expect(component.tradeSuccessReceipt()).toEqual(mockTradeRes);
  });

  it('should handle simulated SELL trade execution', () => {
    paramMap$.next({ get: (k: string) => (k === 'symbol' ? 'RELIANCE' : null) });
    vi.spyOn(marketService, 'getQuote').mockReturnValue(of(mockRelianceQuote));
    vi.spyOn(marketService, 'getCandles').mockReturnValue(of(mockRelianceCandles));
    vi.spyOn(authService, 'isAuthenticated').mockReturnValue(true);

    const mockTradeRes: TradeResponse = {
      orderId: 102,
      transactionId: 202,
      symbol: 'RELIANCE',
      companyName: 'Reliance Industries Ltd',
      orderType: 'SELL',
      orderStatus: 'EXECUTED',
      quantity: 5,
      executionPrice: 2950.5,
      totalAmount: 14752.5,
      remainingCashBalance: 114752.5,
      currentHoldingQuantity: 5,
      executedAt: '2026-10-01T03:00:00Z',
      message: 'Successfully sold 5 shares of RELIANCE'
    };

    const sellSpy = vi.spyOn(tradingService, 'sell').mockReturnValue(of(mockTradeRes));
    vi.spyOn(tradingService, 'getWallet').mockReturnValue(of(mockWallet));
    vi.spyOn(tradingService, 'getHoldingForSymbol').mockReturnValue(of(mockHolding));

    const fixture = TestBed.createComponent(StockDetailsComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.setTradeType('SELL');
    component.setTradeQuantity(5);
    component.submitTrade();

    expect(sellSpy).toHaveBeenCalledWith({ symbol: 'RELIANCE', quantity: 5 });
    expect(component.tradeSuccessReceipt()).toEqual(mockTradeRes);
  });

  it('should detect insufficient balance on BUY', () => {
    const fixture = TestBed.createComponent(StockDetailsComponent);
    const component = fixture.componentInstance;

    component.currentQuote.set(mockRelianceQuote); // price 2950.5
    component.userWallet.set({ cashBalance: 5000, totalInvested: 0, totalPortfolioValue: 5000, currency: 'USD' });
    component.setTradeType('BUY');
    component.setTradeQuantity(10); // total 29,505 > 5,000

    expect(component.hasInsufficientBalance()).toBe(true);
  });

  it('should detect insufficient holdings on SELL', () => {
    const fixture = TestBed.createComponent(StockDetailsComponent);
    const component = fixture.componentInstance;

    component.userHolding.set({ ...mockHolding, quantity: 5 });
    component.setTradeType('SELL');
    component.setTradeQuantity(10); // 10 > 5

    expect(component.hasInsufficientHoldings()).toBe(true);
  });

  it('should handle trade error response gracefully', () => {
    paramMap$.next({ get: (k: string) => (k === 'symbol' ? 'RELIANCE' : null) });
    vi.spyOn(marketService, 'getQuote').mockReturnValue(of(mockRelianceQuote));
    vi.spyOn(marketService, 'getCandles').mockReturnValue(of(mockRelianceCandles));
    vi.spyOn(authService, 'isAuthenticated').mockReturnValue(true);
    vi.spyOn(tradingService, 'buy').mockReturnValue(throwError(() => ({
      error: { message: 'Insufficient virtual balance' }
    })));

    const fixture = TestBed.createComponent(StockDetailsComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.setTradeType('BUY');
    component.setTradeQuantity(10);
    component.submitTrade();

    expect(component.tradeErrorMessage()).toBe('Insufficient virtual balance');
    expect(component.isSubmittingTrade()).toBe(false);
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
});
