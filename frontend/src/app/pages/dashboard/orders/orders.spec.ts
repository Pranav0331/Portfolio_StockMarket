import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { OrdersComponent } from './orders';
import { OrderService } from '../../../services/order.service';
import { OrderPageResponse, ConsolidatedTradePageResponse } from '../../../models/trading.model';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('OrdersComponent', () => {
  let orderService: OrderService;
  let router: Router;

  const mockTradeResponse: ConsolidatedTradePageResponse = {
    content: [
      {
        tradeId: 45,
        entryOrderId: 88,
        exitOrderId: 89,
        symbol: 'BTC/USD',
        companyName: 'Bitcoin',
        exchange: 'CRYPTO',
        currency: 'USD',
        direction: 'SHORT',
        tradingMode: 'INTRADAY',
        leverage: 1,
        quantity: 0.1,
        entryPrice: 81790.35,
        exitPrice: 81776.0,
        realizedPnl: 1.44,
        marginUsed: 8179.04,
        status: 'CLOSED',
        openTime: '2026-10-14T20:00:00Z',
        closeTime: '2026-10-14T20:05:00Z'
      },
      {
        tradeId: 46,
        entryOrderId: 90,
        symbol: 'AAPL',
        companyName: 'Apple Inc.',
        exchange: 'NASDAQ',
        currency: 'USD',
        direction: 'LONG',
        tradingMode: 'INTRADAY',
        leverage: 1,
        quantity: 10,
        entryPrice: 150.0,
        exitPrice: null,
        currentPrice: 152.0,
        unrealizedPnl: 20.0,
        unrealizedPnlPercent: 1.33,
        marginUsed: 1500.0,
        status: 'OPEN',
        openTime: '2026-10-14T20:10:00Z'
      }
    ],
    page: 0,
    size: 15,
    totalElements: 2,
    totalPages: 1,
    first: true,
    last: true
  };

  const mockOrderResponse: OrderPageResponse = {
    content: [
      {
        id: 88,
        positionId: 45,
        symbol: 'BTC/USD',
        companyName: 'Bitcoin',
        exchange: 'CRYPTO',
        currency: 'USD',
        orderType: 'SELL',
        orderStatus: 'EXECUTED',
        positionSide: 'SHORT',
        quantity: 0.1,
        price: 81790.35,
        executedPrice: 81790.35,
        totalAmount: 8179.04,
        executedAt: '2026-10-14T20:00:00Z',
        createdAt: '2026-10-14T20:00:00Z'
      },
      {
        id: 89,
        positionId: 45,
        symbol: 'BTC/USD',
        companyName: 'Bitcoin',
        exchange: 'CRYPTO',
        currency: 'USD',
        orderType: 'BUY',
        orderStatus: 'EXECUTED',
        positionSide: 'SHORT',
        quantity: 0.1,
        price: 81776.0,
        executedPrice: 81776.0,
        realizedPnl: 1.44,
        totalAmount: 8177.6,
        executedAt: '2026-10-14T20:05:00Z',
        createdAt: '2026-10-14T20:05:00Z'
      },
      {
        id: 99,
        symbol: 'BTC/USD',
        companyName: 'Bitcoin',
        exchange: 'CRYPTO',
        currency: 'USD',
        orderType: 'BUY',
        orderStatus: 'PENDING',
        quantity: 0.2,
        price: 75000.0,
        executedPrice: 75000.0,
        totalAmount: 15000.0,
        createdAt: '2026-10-14T20:30:00Z'
      }
    ],
    page: 0,
    size: 15,
    totalElements: 3,
    totalPages: 1,
    first: true,
    last: true
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrdersComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([])
      ]
    }).compileComponents();

    orderService = TestBed.inject(OrderService);
    router = TestBed.inject(Router);
  });

  it('should create OrdersComponent and load consolidated trades on init by default', () => {
    const getTradesSpy = vi.spyOn(orderService, 'getConsolidatedTrades').mockReturnValue(of(mockTradeResponse));

    const fixture = TestBed.createComponent(OrdersComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component).toBeTruthy();
    expect(component.activeView()).toBe('trades');
    expect(getTradesSpy).toHaveBeenCalled();
    expect(component.trades().length).toBe(2);
    expect(component.tradesPageResponse()?.totalElements).toBe(2);
    expect(component.isLoading()).toBe(false);
    expect(component.error()).toBeNull();
  });

  it('should switch between Trades view and Raw Orders view', () => {
    const getTradesSpy = vi.spyOn(orderService, 'getConsolidatedTrades').mockReturnValue(of(mockTradeResponse));
    const getOrdersSpy = vi.spyOn(orderService, 'getOrders').mockReturnValue(of(mockOrderResponse));

    const fixture = TestBed.createComponent(OrdersComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.activeView()).toBe('trades');
    expect(getTradesSpy).toHaveBeenCalledTimes(1);

    component.setActiveView('rawOrders');
    expect(component.activeView()).toBe('rawOrders');
    expect(getOrdersSpy).toHaveBeenCalledTimes(1);
    expect(component.orders().length).toBe(3);

    component.setActiveView('trades');
    expect(component.activeView()).toBe('trades');
    expect(getTradesSpy).toHaveBeenCalledTimes(2);
  });

  it('should filter trades by status (ALL / OPEN / CLOSED)', () => {
    const getTradesSpy = vi.spyOn(orderService, 'getConsolidatedTrades').mockReturnValue(of(mockTradeResponse));

    const fixture = TestBed.createComponent(OrdersComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.setTradeStatusFilter('CLOSED');
    expect(component.selectedTradeStatus()).toBe('CLOSED');
    expect(getTradesSpy).toHaveBeenCalledWith(expect.objectContaining({ status: 'CLOSED' }));

    component.setTradeStatusFilter('OPEN');
    expect(component.selectedTradeStatus()).toBe('OPEN');
    expect(getTradesSpy).toHaveBeenCalledWith(expect.objectContaining({ status: 'OPEN' }));

    component.setTradeStatusFilter('ALL');
    expect(component.selectedTradeStatus()).toBe('ALL');
  });

  it('should filter trades by direction (ALL / LONG / SHORT)', () => {
    const getTradesSpy = vi.spyOn(orderService, 'getConsolidatedTrades').mockReturnValue(of(mockTradeResponse));

    const fixture = TestBed.createComponent(OrdersComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.setTradeDirectionFilter('SHORT');
    expect(component.selectedTradeDirection()).toBe('SHORT');
    expect(getTradesSpy).toHaveBeenCalledWith(expect.objectContaining({ direction: 'SHORT' }));

    component.setTradeDirectionFilter('LONG');
    expect(component.selectedTradeDirection()).toBe('LONG');
    expect(getTradesSpy).toHaveBeenCalledWith(expect.objectContaining({ direction: 'LONG' }));
  });

  it('should filter raw orders by type and status in rawOrders view', () => {
    vi.spyOn(orderService, 'getConsolidatedTrades').mockReturnValue(of(mockTradeResponse));
    const getOrdersSpy = vi.spyOn(orderService, 'getOrders').mockReturnValue(of(mockOrderResponse));

    const fixture = TestBed.createComponent(OrdersComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.setActiveView('rawOrders');

    component.setTypeFilter('BUY');
    expect(component.selectedType()).toBe('BUY');
    expect(getOrdersSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'BUY' }));

    component.setStatusFilter('PENDING');
    expect(component.selectedStatus()).toBe('PENDING');
    expect(getOrdersSpy).toHaveBeenCalledWith(expect.objectContaining({ status: 'PENDING' }));
  });

  it('should filter by symbol and clear search in trades view', () => {
    vi.useFakeTimers();
    const getTradesSpy = vi.spyOn(orderService, 'getConsolidatedTrades').mockReturnValue(of(mockTradeResponse));

    const fixture = TestBed.createComponent(OrdersComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    const mockEvent = { target: { value: 'BTC/USD' } } as any;
    component.onSymbolInput(mockEvent);
    expect(component.symbolSearch()).toBe('BTC/USD');

    vi.advanceTimersByTime(350);
    expect(getTradesSpy).toHaveBeenCalledWith(expect.objectContaining({ symbol: 'BTC/USD' }));

    component.clearSymbolSearch();
    expect(component.symbolSearch()).toBe('');
    expect(getTradesSpy).toHaveBeenCalledWith(expect.objectContaining({ symbol: undefined }));

    vi.useRealTimers();
  });

  it('should reset filters on resetFilters call', () => {
    vi.spyOn(orderService, 'getConsolidatedTrades').mockReturnValue(of(mockTradeResponse));

    const fixture = TestBed.createComponent(OrdersComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.selectedTradeStatus.set('CLOSED');
    component.selectedTradeDirection.set('SHORT');
    component.symbolSearch.set('BTC/USD');
    component.startDate.set('2026-10-01');
    component.endDate.set('2026-10-31');
    component.currentPage.set(2);

    expect(component.hasActiveFilters()).toBe(true);

    component.resetFilters();

    expect(component.selectedTradeStatus()).toBe('ALL');
    expect(component.selectedTradeDirection()).toBe('ALL');
    expect(component.symbolSearch()).toBe('');
    expect(component.startDate()).toBe('');
    expect(component.endDate()).toBe('');
    expect(component.currentPage()).toBe(0);
    expect(component.hasActiveFilters()).toBe(false);
  });

  it('should navigate to stock details when clicking an order or trade row', () => {
    vi.spyOn(orderService, 'getConsolidatedTrades').mockReturnValue(of(mockTradeResponse));
    const navigateSpy = vi.spyOn(router, 'navigate');

    const fixture = TestBed.createComponent(OrdersComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.navigateToStock('BTC/USD');
    expect(navigateSpy).toHaveBeenCalledWith(['/dashboard/stock', 'BTC/USD']);
  });

  it('should handle error when loading fails and allow retry/refresh', () => {
    const getTradesSpy = vi.spyOn(orderService, 'getConsolidatedTrades')
      .mockReturnValueOnce(throwError(() => ({ error: { message: 'Network error' } })))
      .mockReturnValueOnce(of(mockTradeResponse));

    const fixture = TestBed.createComponent(OrdersComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.error()).toBe('Network error');
    expect(component.isLoading()).toBe(false);

    component.refreshOrders();
    expect(getTradesSpy).toHaveBeenCalledTimes(2);
    expect(component.error()).toBeNull();
    expect(component.trades().length).toBe(2);
  });

  it('should render exactly the 10 specified headers without Matched Executions in trades view', () => {
    vi.spyOn(orderService, 'getConsolidatedTrades').mockReturnValue(of(mockTradeResponse));

    const fixture = TestBed.createComponent(OrdersComponent);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const ths = Array.from(compiled.querySelectorAll('.trades-table th')).map(th => th.textContent?.trim());

    expect(ths).toEqual([
      'Open Time',
      'Instrument',
      'Direction',
      'Trading Mode',
      'Qty / Lot',
      'Entry Price',
      'Exit Price',
      'P&L',
      'Status',
      'Action'
    ]);
    expect(ths).not.toContain('Matched Executions');
    expect(compiled.querySelector('.matched-orders-badge')).toBeNull();
  });

  it('should render both visible clickable tab buttons with active styling and switch tables upon click', () => {
    vi.spyOn(orderService, 'getConsolidatedTrades').mockReturnValue(of(mockTradeResponse));
    vi.spyOn(orderService, 'getOrders').mockReturnValue(of(mockOrderResponse));

    const fixture = TestBed.createComponent(OrdersComponent);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const tradesTab = compiled.querySelector('#tab-btn-trades') as HTMLButtonElement;
    const rawOrdersTab = compiled.querySelector('#tab-btn-raw-orders') as HTMLButtonElement;

    expect(tradesTab).toBeTruthy();
    expect(rawOrdersTab).toBeTruthy();
    expect(tradesTab.textContent).toContain('Consolidated Trades');
    expect(rawOrdersTab.textContent).toContain('Raw Orders / Executions');
    expect(tradesTab.classList).toContain('active');
    expect(rawOrdersTab.classList).not.toContain('active');

    // Consolidated trades table visible, raw orders table not present
    expect(compiled.querySelector('.trades-table')).toBeTruthy();

    // Click Raw Orders tab
    rawOrdersTab.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.activeView()).toBe('rawOrders');
    expect(rawOrdersTab.classList).toContain('active');
    expect(tradesTab.classList).not.toContain('active');

    // Click Consolidated Trades tab back
    tradesTab.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.activeView()).toBe('trades');
    expect(tradesTab.classList).toContain('active');
  });

  it('should structure filters into 3 distinct rows preventing Trading Mode clipping and isolating Sort/Reset', () => {
    vi.spyOn(orderService, 'getConsolidatedTrades').mockReturnValue(of(mockTradeResponse));

    const fixture = TestBed.createComponent(OrdersComponent);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;

    // Check 3 distinct rows
    expect(compiled.querySelector('.filters-pills-row')).toBeTruthy();
    expect(compiled.querySelector('.filters-inputs-row')).toBeTruthy();
    expect(compiled.querySelector('.filters-bottom-row')).toBeTruthy();

    // Check all 5 Trading Mode options exist in .fg-trading-mode
    const modePills = Array.from(compiled.querySelectorAll('.fg-trading-mode .pill-btn')).map(b => b.textContent?.trim());
    expect(modePills).toEqual(['All', 'Scalping', 'Intraday', 'Swing', 'Long Term']);

    // Check Sort By and Reset Filters are in the bottom row
    expect(compiled.querySelector('.filters-bottom-row #trade-sort-select')).toBeTruthy();
    expect(compiled.querySelector('.filters-bottom-row .btn-reset')).toBeTruthy();
  });
});
