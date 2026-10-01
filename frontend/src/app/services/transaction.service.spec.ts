import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TransactionService } from './transaction.service';
import { TransactionPageResponse, TransactionFilterParams } from '../models/trading.model';
import { environment } from '../../environments/environment';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('TransactionService', () => {
  let service: TransactionService;
  let httpMock: HttpTestingController;

  const mockResponse: TransactionPageResponse = {
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
      }
    ],
    page: 0,
    size: 15,
    totalElements: 1,
    totalPages: 1,
    first: true,
    last: true
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        TransactionService,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });

    service = TestBed.inject(TransactionService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created with initial empty signals', () => {
    expect(service).toBeTruthy();
    expect(service.transactions()).toEqual([]);
    expect(service.pageResponse()).toBeNull();
    expect(service.isLoading()).toBe(false);
    expect(service.error()).toBeNull();
  });

  it('should fetch transactions and update signals', () => {
    service.getTransactions().subscribe(res => {
      expect(res).toEqual(mockResponse);
    });

    expect(service.isLoading()).toBe(true);

    const req = httpMock.expectOne(`${environment.apiUrl}/transactions`);
    expect(req.request.method).toBe('GET');
    req.flush(mockResponse);

    expect(service.transactions().length).toBe(1);
    expect(service.transactions()[0].symbol).toBe('RELIANCE');
    expect(service.pageResponse()).toEqual(mockResponse);
    expect(service.isLoading()).toBe(false);
    expect(service.error()).toBeNull();
  });

  it('should format query parameters correctly for filters', () => {
    const filters: TransactionFilterParams = {
      type: 'BUY',
      symbol: 'AAPL',
      startDate: '2026-09-01',
      endDate: '2026-09-30',
      page: 1,
      size: 10,
      sort: 'asc'
    };

    service.getTransactions(filters).subscribe();

    const req = httpMock.expectOne(request => {
      return request.url === `${environment.apiUrl}/transactions` &&
        request.params.get('type') === 'BUY' &&
        request.params.get('symbol') === 'AAPL' &&
        request.params.get('startDate') === '2026-09-01' &&
        request.params.get('endDate') === '2026-09-30' &&
        request.params.get('page') === '1' &&
        request.params.get('size') === '10' &&
        request.params.get('sort') === 'asc';
    });

    expect(req.request.method).toBe('GET');
    req.flush(mockResponse);
  });

  it('should handle error when API request fails', () => {
    service.getTransactions().subscribe({
      error: () => {
        expect(service.error()).toBe('Server error');
        expect(service.isLoading()).toBe(false);
      }
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/transactions`);
    req.flush({ message: 'Server error' }, { status: 500, statusText: 'Internal Server Error' });
  });
});
