import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { MarketComponent } from './market';
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

  // HTMLCanvasElement mock for headless test environment
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

describe('MarketComponent', () => {
  let marketService: MarketService;

  const mockQuote: StockQuote = {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    price: 329.4,
    change: -9.0,
    changePercent: '-2.66%',
    previousClose: 338.4,
    open: 336.97,
    high: 337.09,
    low: 328.7,
    volume: 38427200,
    latestTradingDay: '2026-09-29',
    timestamp: 1727690000
  };

  const mockCandles: CandleSeries = {
    symbol: 'AAPL',
    interval: '5min',
    currency: 'USD',
    exchange: 'NASDAQ',
    type: 'Common Stock',
    candles: [
      {
        timestamp: 1727690000,
        datetime: '2026-09-29 15:50:00',
        open: 329.35,
        high: 329.85,
        low: 329.1,
        close: 329.69,
        volume: 969882
      },
      {
        timestamp: 1727690300,
        datetime: '2026-09-29 15:55:00',
        open: 329.67,
        high: 329.67,
        low: 328.7,
        close: 329.59,
        volume: 2115651
      }
    ]
  };

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
    vi.spyOn(marketService, 'getQuote').mockReturnValue(of(mockQuote));
    vi.spyOn(marketService, 'getCandles').mockReturnValue(of(mockCandles));
  });

  it('should create MarketComponent and initialize trading terminal', async () => {
    const fixture = TestBed.createComponent(MarketComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component).toBeTruthy();
    expect(component.selectedSymbol()).toBe('AAPL');

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.market-trading-terminal')).toBeTruthy();
    expect(compiled.querySelector('#terminal-global-search-input')).toBeTruthy();
    expect(compiled.querySelector('.instrument-ticker-strip')).toBeTruthy();
    expect(compiled.querySelector('.chart-main-pane')).toBeTruthy();
    expect(compiled.querySelector('.watchlist-compact-pane')).toBeTruthy();
  });

  it('should display instrument header, price and change badge', async () => {
    const fixture = TestBed.createComponent(MarketComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.symbol-badge')?.textContent).toContain('AAPL');
    expect(compiled.querySelector('.price-val')?.textContent).toContain('329.40');
    expect(compiled.querySelector('.delta-pill')?.textContent).toContain('-9.00');
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

  it('should change chart type and interval', () => {
    const fixture = TestBed.createComponent(MarketComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.currentChartType()).toBe('candles');
    component.setChartType('line');
    expect(component.currentChartType()).toBe('line');
    component.setChartType('area');
    expect(component.currentChartType()).toBe('area');

    component.setInterval('15min');
    expect(component.currentInterval()).toBe('15min');
  });

  it('should load instrument when selected from search or watchlist', async () => {
    const btcQuote: StockQuote = {
      symbol: 'BTC/USD',
      name: 'Bitcoin',
      price: 83128.01,
      change: -535.65,
      changePercent: '-0.64%',
      timestamp: 1727690000
    };
    const btcCandles: CandleSeries = {
      symbol: 'BTC/USD',
      interval: '5min',
      candles: [
        {
          timestamp: 1727690000,
          open: 83300,
          high: 83400,
          low: 83100,
          close: 83128.01,
          volume: 1500
        }
      ]
    };

    vi.spyOn(marketService, 'getQuote').mockReturnValue(of(btcQuote));
    vi.spyOn(marketService, 'getCandles').mockReturnValue(of(btcCandles));

    const fixture = TestBed.createComponent(MarketComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.loadInstrument('BTC/USD', 'Bitcoin', 'Coinbase', 'crypto');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.selectedSymbol()).toBe('BTC/USD');
    expect(component.selectedCompanyName()).toBe('Bitcoin');
  });

  it('should display rate limit notice when 429 occurs', async () => {
    vi.spyOn(marketService, 'getQuote').mockReturnValue(
      throwError(() => ({ status: 429, message: 'Too Many Requests' }))
    );
    vi.spyOn(marketService, 'getCandles').mockReturnValue(
      throwError(() => ({ status: 429, message: 'Too Many Requests' }))
    );

    const fixture = TestBed.createComponent(MarketComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.loadInstrument('NVDA');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.isRateLimited()).toBe(true);
    expect(component.errorMessage()).toContain('rate limit');
  });

  it('should render Reset / Fit button and invoke fitChart on click', async () => {
    const fixture = TestBed.createComponent(MarketComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();

    const fitSpy = vi.spyOn(component, 'fitChart');
    const compiled = fixture.nativeElement as HTMLElement;
    const resetBtn = compiled.querySelector('#chart-reset-btn') as HTMLButtonElement;
    expect(resetBtn).toBeTruthy();
    expect(resetBtn.textContent).toContain('Reset');

    resetBtn.click();
    expect(fitSpy).toHaveBeenCalled();
  });

  it('should render Indicators toolbar button and open/close modal', async () => {
    const fixture = TestBed.createComponent(MarketComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    const indBtn = compiled.querySelector('#indicators-modal-trigger-btn') as HTMLButtonElement;
    expect(indBtn).toBeTruthy();
    expect(indBtn.textContent).toContain('Indicators');

    expect(component.isIndicatorModalOpen()).toBe(false);
    indBtn.click();
    fixture.detectChanges();
    expect(component.isIndicatorModalOpen()).toBe(true);

    const modal = compiled.querySelector('.indicator-modal-dialog');
    expect(modal).toBeTruthy();

    const closeBtn = compiled.querySelector('.modal-close-btn') as HTMLButtonElement;
    closeBtn.click();
    fixture.detectChanges();
    expect(component.isIndicatorModalOpen()).toBe(false);
  });

  it('should filter indicators by search query and category', async () => {
    const fixture = TestBed.createComponent(MarketComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();

    component.openIndicatorModal();
    fixture.detectChanges();

    expect(component.indicatorLibrary().length).toBeGreaterThanOrEqual(25);
    expect(component.filteredIndicators().length).toBe(component.indicatorLibrary().length);

    // Filter by category
    component.setIndicatorCategory('momentum');
    fixture.detectChanges();
    expect(component.filteredIndicators().every(i => i.category === 'momentum')).toBe(true);

    // Filter by search keyword 'Bollinger'
    component.setIndicatorCategory('all');
    component.indicatorSearchQuery.set('Bollinger');
    fixture.detectChanges();
    expect(component.filteredIndicators().length).toBeGreaterThanOrEqual(1);
    expect(component.filteredIndicators()[0].name).toContain('Bollinger Bands');
  });

  it('should add, toggle enable/disable, open settings and remove multiple indicators', async () => {
    const fixture = TestBed.createComponent(MarketComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();

    const smaDef = component.indicatorLibrary().find(i => i.id === 'sma')!;
    const rsiDef = component.indicatorLibrary().find(i => i.id === 'rsi')!;
    const bbDef = component.indicatorLibrary().find(i => i.id === 'bb')!;

    // Add multiple indicators simultaneously
    component.addIndicator(smaDef);
    component.addIndicator(rsiDef);
    component.addIndicator(bbDef);
    fixture.detectChanges();

    expect(component.activeIndicators().length).toBe(3);
    expect(component.isIndicatorActive('sma')).toBe(true);
    expect(component.isIndicatorActive('rsi')).toBe(true);
    expect(component.isIndicatorActive('bb')).toBe(true);

    const firstActive = component.activeIndicators()[0];

    // Toggle visibility (enable/disable)
    expect(firstActive.enabled).toBe(true);
    component.toggleIndicatorEnabled(firstActive.instanceId);
    fixture.detectChanges();
    expect(component.activeIndicators()[0].enabled).toBe(false);

    component.toggleIndicatorEnabled(firstActive.instanceId);
    fixture.detectChanges();
    expect(component.activeIndicators()[0].enabled).toBe(true);

    // Open settings and save customized parameters
    component.openIndicatorSettings(firstActive);
    fixture.detectChanges();
    expect(component.editingIndicator()).toBeTruthy();

    component.updateEditingParam('period', 200);
    component.editingColor.set('#ef4444');
    component.editingLineWidth.set(3);
    component.saveIndicatorSettings();
    fixture.detectChanges();

    expect(component.editingIndicator()).toBeNull();
    const updatedActive = component.activeIndicators().find(i => i.instanceId === firstActive.instanceId)!;
    expect(updatedActive.params['period']).toBe(200);
    expect(updatedActive.color).toBe('#ef4444');
    expect(updatedActive.lineWidth).toBe(3);

    // Remove single indicator
    component.removeIndicator(firstActive.instanceId);
    fixture.detectChanges();
    expect(component.activeIndicators().length).toBe(2);

    // Clear all
    component.clearAllIndicators();
    fixture.detectChanges();
    expect(component.activeIndicators().length).toBe(0);
  });
});

