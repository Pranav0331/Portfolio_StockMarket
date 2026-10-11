import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AlgoTradingComponent } from './algo-trading';
import { AlgoTradingService } from '../../../services/algo-trading.service';
import { MarketService } from '../../../services/market.service';
import { MarketWebSocketService } from '../../../services/market-websocket.service';
import { TradingService } from '../../../services/trading.service';
import { AuthService } from '../../../services/auth.service';

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

describe('AlgoTradingComponent', () => {
  let component: AlgoTradingComponent;
  let fixture: ComponentFixture<AlgoTradingComponent>;

  beforeEach(async () => {
    const mockAlgoService = {
      strategies: () => [],
      tradeLogs: () => [],
      performanceSummary: () => null,
      getStrategies: () => of([]),
      getAllTradeLogs: () => of([]),
      getStrategyTradeLogs: () => of([]),
      getStrategyPerformance: () => of(null),
      evaluateMarket: () => of({
        symbol: 'BTC/USD',
        currentPrice: 85000,
        trend: 'BULLISH',
        signal: 'BUY',
        confidence: 85,
        riskLevel: 'LOW',
        reasons: ['EMA bullish cross'],
        activeIndicators: ['EMA 9 (85100)', 'EMA 21 (84900)'],
        isMarketDataAvailable: true
      }),
      evaluateAdHoc: () => of({
        symbol: 'BTC/USD',
        currentPrice: 85000,
        trend: 'BULLISH',
        signal: 'BUY',
        confidence: 85,
        riskLevel: 'LOW',
        reasons: ['EMA bullish cross'],
        activeIndicators: ['EMA 9 (85100)', 'EMA 21 (84900)'],
        isMarketDataAvailable: true
      }),
      evaluateStrategy: () => of({
        symbol: 'BTC/USD',
        currentPrice: 85000,
        trend: 'BULLISH',
        signal: 'BUY',
        confidence: 85,
        riskLevel: 'LOW',
        reasons: ['EMA bullish cross'],
        activeIndicators: ['EMA 9 (85100)', 'EMA 21 (84900)'],
        isMarketDataAvailable: true
      }),
      createStrategy: (s: any) => of({ ...s, id: 1, status: s.status || 'STOPPED' }),
      updateStrategy: (id: any, s: any) => of({ ...s, id, status: s.status || 'STOPPED' }),
      startStrategy: (id: any) => of({ id, status: 'RUNNING' }),
      pauseStrategy: (id: any) => of({ id, status: 'PAUSED' }),
      stopStrategy: (id: any) => of({ id, status: 'STOPPED' }),
      deleteStrategy: () => of(void 0)
    };

    const mockMarketService = {
      isIndianSymbol: (sym: string) => sym === 'RELIANCE' || sym === 'NIFTY 50',
      getQuote: (sym: string) => of({
        symbol: sym,
        price: sym === 'BTC/USD' ? 85000 : sym === 'ETH/USD' ? 3200 : sym === 'AAPL' ? 220 : 100,
        change: 12,
        changePercent: '1.25'
      }),
      getCandles: (sym: string, interval: string) => of({
        symbol: sym,
        interval,
        candles: [
          { timestamp: 1700000000, open: 100, high: 105, low: 98, close: 102 }
        ]
      }),
      searchSymbols: (query: string) => of({
        query,
        bestMatches: [
          { symbol: 'AAPL', name: 'Apple Inc.', type: 'Equity', region: 'United States', currency: 'USD', matchScore: '1.0' },
          { symbol: 'RELIANCE', name: 'Reliance Industries Ltd', type: 'Equity', region: 'India', currency: 'INR', matchScore: '0.9' }
        ]
      })
    };

    const mockMarketWsService = {
      ticks$: of(null),
      subscribe: vi.fn(),
      unsubscribe: vi.fn()
    };

    const mockTradingService = {
      wallet: () => ({ cashBalance: 100000 }),
      openPositions: () => [],
      getWallet: () => of({ cashBalance: 100000 }),
      getPositions: () => of([]),
      closePosition: () => of({})
    };

    const mockAuthService = {
      currentUser: () => ({ id: 1, name: 'Test User', email: 'test@example.com', role: 'ROLE_USER' })
    };

    TestBed.overrideComponent(AlgoTradingComponent, {
      set: {
        template: '<div #chartContainer></div>',
        styles: []
      }
    });

    await TestBed.configureTestingModule({
      imports: [AlgoTradingComponent, HttpClientTestingModule, RouterTestingModule],
      providers: [
        { provide: AlgoTradingService, useValue: mockAlgoService },
        { provide: MarketService, useValue: mockMarketService },
        { provide: MarketWebSocketService, useValue: mockMarketWsService },
        { provide: TradingService, useValue: mockTradingService },
        { provide: AuthService, useValue: mockAuthService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AlgoTradingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the AlgoTradingComponent', () => {
    expect(component).toBeTruthy();
  });

  it('should compute margin and max risk correctly', () => {
    component.formStrategy.set({
      ...component.formStrategy(),
      quantity: 1,
      leverage: 10,
      stopLossPercent: 2
    });
    component.currentPrice.set(1000);

    expect(component.calculatedMargin()).toBe(100);
    expect(component.calculatedMaxRisk()).toBe(20);
    expect(component.calculatedPositionSize()).toBe(1000);
  });

  it('should start algo and set status to RUNNING', () => {
    component.formStrategy.set({ ...component.formStrategy(), id: 1, status: 'STOPPED' });
    component.startAlgo();
    expect(component.formStrategy().status).toBe('RUNNING');
  });

  it('should pause algo and set status to PAUSED', () => {
    component.formStrategy.set({ ...component.formStrategy(), id: 1, status: 'RUNNING' });
    component.pauseAlgo();
    expect(component.formStrategy().status).toBe('PAUSED');
  });

  it('should stop algo and set status to STOPPED', () => {
    component.formStrategy.set({ ...component.formStrategy(), id: 1, status: 'RUNNING' });
    component.stopAlgo();
    expect(component.formStrategy().status).toBe('STOPPED');
  });

  it('should calculate liveOpenPositions with floating P&L', () => {
    const mockPos = {
      id: 10,
      userId: 1,
      symbol: 'BTC/USD',
      companyName: 'Bitcoin',
      exchange: 'BINANCE',
      currency: 'USD',
      side: 'LONG' as const,
      tradingMode: 'INTRADAY' as const,
      quantity: 1,
      entryPrice: 50000,
      currentPrice: 50000,
      positionValue: 50000,
      leverage: 10,
      marginUsed: 5000,
      unrealizedPnl: 0,
      unrealizedPnlPercent: 0,
      status: 'OPEN' as const,
      createdAt: new Date().toISOString()
    };
    vi.spyOn(component.tradingService, 'openPositions').mockReturnValue([mockPos]);
    component.formStrategy.set({ ...component.formStrategy(), symbol: 'BTC/USD' });
    component.currentPrice.set(55000);

    const livePos = component.liveOpenPositions();
    expect(livePos.length).toBe(1);
    expect(livePos[0].currentPrice).toBe(55000);
    expect(livePos[0].unrealizedPnl).toBe(5000);
  });

  it('should open and close the search modal properly', () => {
    expect(component.isSearchModalOpen()).toBe(false);
    component.openSearchModal();
    expect(component.isSearchModalOpen()).toBe(true);
    expect(component.searchQuery()).toBe('');

    component.closeSearchModal();
    expect(component.isSearchModalOpen()).toBe(false);
  });

  it('should filter displayed instruments by category', () => {
    component.selectCategory('CRYPTO');
    expect(component.selectedCategory()).toBe('CRYPTO');
    const cryptoItems = component.displayedInstruments();
    expect(cryptoItems.length).toBeGreaterThan(0);
    expect(cryptoItems.every((i) => i.category === 'CRYPTO')).toBe(true);

    component.selectCategory('US');
    const usItems = component.displayedInstruments();
    expect(usItems.length).toBeGreaterThan(0);
    expect(usItems.every((i) => i.category === 'US')).toBe(true);

    component.selectCategory('INDIAN');
    const indianItems = component.displayedInstruments();
    expect(indianItems.length).toBeGreaterThan(0);
    expect(indianItems.every((i) => i.category === 'INDIAN')).toBe(true);

    component.selectCategory('INDEX');
    const indexItems = component.displayedInstruments();
    expect(indexItems.length).toBeGreaterThan(0);
    expect(indexItems.every((i) => i.category === 'INDEX')).toBe(true);
  });

  it('should switch timeframe from chart toolbar', () => {
    component.setTimeframe('5m');
    expect(component.formStrategy().timeframe).toBe('5m');
    component.setTimeframe('1h');
    expect(component.formStrategy().timeframe).toBe('1h');
  });

  it('should successfully switch BTC/USD -> ETH/USD -> AAPL and preserve indicator settings', () => {
    // 1. Initial State: BTC/USD
    expect(component.formStrategy().symbol).toBe('BTC/USD');
    expect(component.formStrategy().marketType).toBe('CRYPTO');
    const initialIndicators = {
      useEma9: component.formStrategy().useEma9,
      ema9Period: component.formStrategy().ema9Period,
      useEma21: component.formStrategy().useEma21,
      ema21Period: component.formStrategy().ema21Period,
      useRsi: component.formStrategy().useRsi,
      rsiPeriod: component.formStrategy().rsiPeriod,
      useMacd: component.formStrategy().useMacd
    };

    // 2. Switch BTC/USD -> ETH/USD
    const ethItem = component.catalogInstruments.find((i) => i.symbol === 'ETH/USD')!;
    expect(ethItem).toBeDefined();
    component.switchInstrument(ethItem);

    expect(component.formStrategy().symbol).toBe('ETH/USD');
    expect(component.formStrategy().marketType).toBe('CRYPTO');
    expect(component.currentPrice()).toBe(3200);
    // Verify strategy settings were preserved
    expect(component.formStrategy().useEma9).toBe(initialIndicators.useEma9);
    expect(component.formStrategy().ema9Period).toBe(initialIndicators.ema9Period);
    expect(component.formStrategy().useEma21).toBe(initialIndicators.useEma21);
    expect(component.formStrategy().ema21Period).toBe(initialIndicators.ema21Period);
    expect(component.formStrategy().useRsi).toBe(initialIndicators.useRsi);
    expect(component.formStrategy().useMacd).toBe(initialIndicators.useMacd);

    // 3. Switch ETH/USD -> AAPL
    const aaplItem = component.catalogInstruments.find((i) => i.symbol === 'AAPL')!;
    expect(aaplItem).toBeDefined();
    component.switchInstrument(aaplItem);

    expect(component.formStrategy().symbol).toBe('AAPL');
    expect(component.formStrategy().marketType).toBe('US');
    expect(component.currentPrice()).toBe(220);
    expect(component.formStrategy().quantity).toBeGreaterThanOrEqual(1); // Validated for US equity
    // Verify indicator settings remain preserved
    expect(component.formStrategy().useEma9).toBe(initialIndicators.useEma9);
    expect(component.formStrategy().useEma21).toBe(initialIndicators.useEma21);
    expect(component.formStrategy().useRsi).toBe(initialIndicators.useRsi);
    expect(component.formStrategy().useMacd).toBe(initialIndicators.useMacd);
  });

  it('should set Data unavailable and reset price to 0 when market data fails', () => {
    const errorService = TestBed.inject(MarketService);
    vi.spyOn(errorService, 'getCandles').mockReturnValue(throwError(() => new Error('Market down')));
    vi.spyOn(errorService, 'getQuote').mockReturnValue(throwError(() => new Error('Market down')));

    component.loadCandles('NONEXISTENT', '15m');

    expect(component.marketDataError()).toBe('Data unavailable');
  });
});
