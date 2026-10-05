import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';
import { AlgoTradingComponent } from './algo-trading';
import { AlgoTradingService } from '../../../services/algo-trading.service';
import { MarketService } from '../../../services/market.service';
import { MarketWebSocketService } from '../../../services/market-websocket.service';
import { TradingService } from '../../../services/trading.service';
import { AuthService } from '../../../services/auth.service';

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
        timestamp: new Date().toISOString(),
        marketTrend: 'BULLISH',
        signal: 'BUY',
        confidence: 85,
        riskLevel: 'LOW',
        reasons: ['EMA bullish cross'],
        activeIndicators: { 'EMA 9': 85100, 'EMA 21': 84900 },
        isMarketDataAvailable: true
      }),
      evaluateStrategy: () => of(null),
      createStrategy: (s: any) => of({ ...s, id: 1 }),
      updateStrategy: (id: any, s: any) => of({ ...s, id }),
      startStrategy: () => of({
        symbol: 'BTC/USD',
        currentPrice: 85000,
        timestamp: new Date().toISOString(),
        marketTrend: 'BULLISH',
        signal: 'BUY',
        confidence: 85,
        riskLevel: 'LOW',
        reasons: ['EMA cross'],
        activeIndicators: {},
        isMarketDataAvailable: true
      }),
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
});
