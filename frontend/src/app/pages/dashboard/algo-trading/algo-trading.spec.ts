import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';
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
      isIndianSymbol: (sym: string) => sym === 'RELIANCE',
      getQuote: () => of({ symbol: 'BTC/USD', price: 85000, change: 120, changePercent: 0.15 }),
      getCandles: () => of({ symbol: 'BTC/USD', interval: '15min', candles: [] })
    };

    const mockMarketWsService = {
      ticks$: of(null),
      subscribe: () => {},
      unsubscribe: () => {}
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
});
