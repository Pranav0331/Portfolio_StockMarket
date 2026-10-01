import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { TransactionsComponent } from './transactions';
import { TransactionService } from '../../../services/transaction.service';
import { TransactionPageResponse } from '../../../models/trading.model';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('TransactionsComponent', () => {
  let transactionService: TransactionService;
  let router: Router;

  const mockTxResponse: TransactionPageResponse = {
    content: [
      {
        transactionId: 101,
        orderId: 501,
        symbol: 'RELIANCE',
        companyName: 'Reliance Industries Ltd',
        exchange: 'NSE',
        currency: 'INR',
        type: 'BUY',
        status: 'EXECUTED',
        quantity: 10,
        executionPrice: 2950.0,
        totalAmount: 29500.0,
        fees: 0,
        executedAt: '2026-09-30T10:00:00Z'
      },
      {
        transactionId: 102,
        orderId: 502,
        symbol: 'AAPL',
        companyName: 'Apple Inc.',
        exchange: 'NASDAQ',
        currency: 'USD',
        type: 'SELL',
        status: 'EXECUTED',
        quantity: 5,
        executionPrice: 230.0,
        totalAmount: 1150.0,
        fees: 0,
        executedAt: '2026-09-30T14:30:00Z'
      }
    ],
    page: 0,
    size: 15,
    totalElements: 2,
    totalPages: 1,
    first: true,
    last: true
  };

  const mockEmptyResponse: TransactionPageResponse = {
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
      imports: [TransactionsComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([])
      ]
    }).compileComponents();

    transactionService = TestBed.inject(TransactionService);
    router = TestBed.inject(Router);
  });

  it('should create TransactionsComponent and load history on init', () => {
    const getTxSpy = vi.spyOn(transactionService, 'getTransactions').mockReturnValue(of(mockTxResponse));

    const fixture = TestBed.createComponent(TransactionsComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component).toBeTruthy();
    expect(getTxSpy).toHaveBeenCalled();
    expect(component.transactions().length).toBe(2);
    expect(component.pageResponse()?.totalElements).toBe(2);
    expect(component.isLoading()).toBe(false);
    expect(component.error()).toBeNull();
  });

  it('should filter by transaction type (BUY / SELL / ALL)', () => {
    const getTxSpy = vi.spyOn(transactionService, 'getTransactions').mockReturnValue(of(mockTxResponse));

    const fixture = TestBed.createComponent(TransactionsComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.setTypeFilter('BUY');
    expect(component.selectedType()).toBe('BUY');
    expect(component.currentPage()).toBe(0);
    expect(getTxSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'BUY' }));

    component.setTypeFilter('SELL');
    expect(component.selectedType()).toBe('SELL');
    expect(getTxSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'SELL' }));

    component.setTypeFilter('ALL');
    expect(component.selectedType()).toBe('ALL');
  });

  it('should filter by symbol and clear symbol filter', () => {
    vi.useFakeTimers();
    const getTxSpy = vi.spyOn(transactionService, 'getTransactions').mockReturnValue(of(mockTxResponse));

    const fixture = TestBed.createComponent(TransactionsComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    const mockEvent = { target: { value: 'AAPL' } } as any;
    component.onSymbolInput(mockEvent);
    expect(component.symbolSearch()).toBe('AAPL');

    vi.advanceTimersByTime(350);
    expect(getTxSpy).toHaveBeenCalledWith(expect.objectContaining({ symbol: 'AAPL' }));

    component.clearSymbolSearch();
    expect(component.symbolSearch()).toBe('');
    expect(getTxSpy).toHaveBeenCalledWith(expect.objectContaining({ symbol: undefined }));

    vi.useRealTimers();
  });

  it('should filter by date range and sorting', () => {
    const getTxSpy = vi.spyOn(transactionService, 'getTransactions').mockReturnValue(of(mockTxResponse));

    const fixture = TestBed.createComponent(TransactionsComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.onStartDateChange({ target: { value: '2026-09-01' } } as any);
    expect(component.startDate()).toBe('2026-09-01');
    expect(getTxSpy).toHaveBeenCalledWith(expect.objectContaining({ startDate: '2026-09-01' }));

    component.onEndDateChange({ target: { value: '2026-09-30' } } as any);
    expect(component.endDate()).toBe('2026-09-30');
    expect(getTxSpy).toHaveBeenCalledWith(expect.objectContaining({ endDate: '2026-09-30' }));

    component.onSortChange({ target: { value: 'asc' } } as any);
    expect(component.sortDirection()).toBe('asc');
    expect(getTxSpy).toHaveBeenCalledWith(expect.objectContaining({ sort: 'asc' }));
  });

  it('should reset all filters on resetFilters call', () => {
    vi.spyOn(transactionService, 'getTransactions').mockReturnValue(of(mockTxResponse));

    const fixture = TestBed.createComponent(TransactionsComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.selectedType.set('SELL');
    component.symbolSearch.set('AAPL');
    component.startDate.set('2026-09-01');
    component.endDate.set('2026-09-30');
    component.sortDirection.set('asc');
    component.currentPage.set(2);

    expect(component.hasActiveFilters()).toBe(true);

    component.resetFilters();

    expect(component.selectedType()).toBe('ALL');
    expect(component.symbolSearch()).toBe('');
    expect(component.startDate()).toBe('');
    expect(component.endDate()).toBe('');
    expect(component.sortDirection()).toBe('desc');
    expect(component.currentPage()).toBe(0);
    expect(component.hasActiveFilters()).toBe(false);
  });

  it('should navigate to page on pagination control', () => {
    const multiPageResponse: TransactionPageResponse = {
      ...mockTxResponse,
      page: 0,
      totalPages: 3,
      totalElements: 45
    };

    const getTxSpy = vi.spyOn(transactionService, 'getTransactions').mockReturnValue(of(multiPageResponse));

    const fixture = TestBed.createComponent(TransactionsComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.goToPage(1);
    expect(component.currentPage()).toBe(1);
    expect(getTxSpy).toHaveBeenCalledWith(expect.objectContaining({ page: 1 }));
  });

  it('should navigate to stock details when clicking a transaction row', () => {
    vi.spyOn(transactionService, 'getTransactions').mockReturnValue(of(mockTxResponse));
    const navigateSpy = vi.spyOn(router, 'navigate');

    const fixture = TestBed.createComponent(TransactionsComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.navigateToStock('RELIANCE');
    expect(navigateSpy).toHaveBeenCalledWith(['/dashboard/stock', 'RELIANCE']);
  });

  it('should handle empty state when 0 transactions exist', () => {
    vi.spyOn(transactionService, 'getTransactions').mockReturnValue(of(mockEmptyResponse));

    const fixture = TestBed.createComponent(TransactionsComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.transactions().length).toBe(0);
    expect(component.pageResponse()?.totalElements).toBe(0);
  });

  it('should handle error when loading fails and allow retry', () => {
    const getTxSpy = vi.spyOn(transactionService, 'getTransactions')
      .mockReturnValueOnce(throwError(() => ({ error: { message: 'Database connection failed' } })))
      .mockReturnValueOnce(of(mockTxResponse));

    const fixture = TestBed.createComponent(TransactionsComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.error()).toBe('Database connection failed');
    expect(component.isLoading()).toBe(false);

    component.refreshTransactions();
    expect(getTxSpy).toHaveBeenCalledTimes(2);
    expect(component.error()).toBeNull();
    expect(component.transactions().length).toBe(2);
  });
});
