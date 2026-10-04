import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { OrdersComponent } from './orders';
import { OrderService } from '../../../services/order.service';
import { OrderPageResponse } from '../../../models/trading.model';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('OrdersComponent', () => {
  let orderService: OrderService;
  let router: Router;

  const mockOrderResponse: OrderPageResponse = {
    content: [
      {
        id: 501,
        symbol: 'RELIANCE',
        companyName: 'Reliance Industries Ltd',
        exchange: 'NSE',
        currency: 'INR',
        orderType: 'BUY',
        orderStatus: 'EXECUTED',
        quantity: 10,
        price: 2950.0,
        executedPrice: 2950.0,
        totalAmount: 29500.0,
        executedAt: '2026-09-30T10:00:00Z',
        createdAt: '2026-09-30T10:00:00Z'
      },
      {
        id: 502,
        symbol: 'AAPL',
        companyName: 'Apple Inc.',
        exchange: 'NASDAQ',
        currency: 'USD',
        orderType: 'SELL',
        orderStatus: 'EXECUTED',
        quantity: 5,
        price: 230.0,
        executedPrice: 230.0,
        totalAmount: 1150.0,
        executedAt: '2026-09-30T14:30:00Z',
        createdAt: '2026-09-30T14:30:00Z'
      }
    ],
    page: 0,
    size: 15,
    totalElements: 2,
    totalPages: 1,
    first: true,
    last: true
  };

  const mockEmptyResponse: OrderPageResponse = {
    content: [],
    page: 0,
    size: 15,
    totalElements: 0,
    totalPages: 0,
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

  it('should create OrdersComponent and load order book on init', () => {
    const getOrdersSpy = vi.spyOn(orderService, 'getOrders').mockReturnValue(of(mockOrderResponse));

    const fixture = TestBed.createComponent(OrdersComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component).toBeTruthy();
    expect(getOrdersSpy).toHaveBeenCalled();
    expect(component.orders().length).toBe(2);
    expect(component.pageResponse()?.totalElements).toBe(2);
    expect(component.isLoading()).toBe(false);
    expect(component.error()).toBeNull();
  });

  it('should filter by order type (BUY / SELL / ALL)', () => {
    const getOrdersSpy = vi.spyOn(orderService, 'getOrders').mockReturnValue(of(mockOrderResponse));

    const fixture = TestBed.createComponent(OrdersComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.setTypeFilter('BUY');
    expect(component.selectedType()).toBe('BUY');
    expect(component.currentPage()).toBe(0);
    expect(getOrdersSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'BUY' }));

    component.setTypeFilter('SELL');
    expect(component.selectedType()).toBe('SELL');
    expect(getOrdersSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'SELL' }));

    component.setTypeFilter('ALL');
    expect(component.selectedType()).toBe('ALL');
  });

  it('should filter by order status (EXECUTED / PENDING / ALL)', () => {
    const getOrdersSpy = vi.spyOn(orderService, 'getOrders').mockReturnValue(of(mockOrderResponse));

    const fixture = TestBed.createComponent(OrdersComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.setStatusFilter('EXECUTED');
    expect(component.selectedStatus()).toBe('EXECUTED');
    expect(getOrdersSpy).toHaveBeenCalledWith(expect.objectContaining({ status: 'EXECUTED' }));

    component.setStatusFilter('PENDING');
    expect(component.selectedStatus()).toBe('PENDING');
    expect(getOrdersSpy).toHaveBeenCalledWith(expect.objectContaining({ status: 'PENDING' }));
  });

  it('should filter by symbol and clear search', () => {
    vi.useFakeTimers();
    const getOrdersSpy = vi.spyOn(orderService, 'getOrders').mockReturnValue(of(mockOrderResponse));

    const fixture = TestBed.createComponent(OrdersComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    const mockEvent = { target: { value: 'AAPL' } } as any;
    component.onSymbolInput(mockEvent);
    expect(component.symbolSearch()).toBe('AAPL');

    vi.advanceTimersByTime(350);
    expect(getOrdersSpy).toHaveBeenCalledWith(expect.objectContaining({ symbol: 'AAPL' }));

    component.clearSymbolSearch();
    expect(component.symbolSearch()).toBe('');
    expect(getOrdersSpy).toHaveBeenCalledWith(expect.objectContaining({ symbol: undefined }));

    vi.useRealTimers();
  });

  it('should reset filters on resetFilters call', () => {
    vi.spyOn(orderService, 'getOrders').mockReturnValue(of(mockOrderResponse));

    const fixture = TestBed.createComponent(OrdersComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.selectedType.set('SELL');
    component.selectedStatus.set('EXECUTED');
    component.symbolSearch.set('AAPL');
    component.startDate.set('2026-09-01');
    component.endDate.set('2026-09-30');
    component.sortDirection.set('asc');
    component.currentPage.set(2);

    expect(component.hasActiveFilters()).toBe(true);

    component.resetFilters();

    expect(component.selectedType()).toBe('ALL');
    expect(component.selectedStatus()).toBe('ALL');
    expect(component.symbolSearch()).toBe('');
    expect(component.startDate()).toBe('');
    expect(component.endDate()).toBe('');
    expect(component.sortDirection()).toBe('desc');
    expect(component.currentPage()).toBe(0);
    expect(component.hasActiveFilters()).toBe(false);
  });

  it('should navigate to stock details when clicking an order row', () => {
    vi.spyOn(orderService, 'getOrders').mockReturnValue(of(mockOrderResponse));
    const navigateSpy = vi.spyOn(router, 'navigate');

    const fixture = TestBed.createComponent(OrdersComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.navigateToStock('BTC/USD');
    expect(navigateSpy).toHaveBeenCalledWith(['/dashboard/stock', 'BTC/USD']);
  });

  it('should handle error when loading fails and allow refresh', () => {
    const getOrdersSpy = vi.spyOn(orderService, 'getOrders')
      .mockReturnValueOnce(throwError(() => ({ error: { message: 'Network error' } })))
      .mockReturnValueOnce(of(mockOrderResponse));

    const fixture = TestBed.createComponent(OrdersComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.error()).toBe('Network error');
    expect(component.isLoading()).toBe(false);

    component.refreshOrders();
    expect(getOrdersSpy).toHaveBeenCalledTimes(2);
    expect(component.error()).toBeNull();
    expect(component.orders().length).toBe(2);
  });
});
