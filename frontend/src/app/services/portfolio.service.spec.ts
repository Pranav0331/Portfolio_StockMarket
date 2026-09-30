import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PortfolioService } from './portfolio.service';
import { PortfolioSummary } from '../models/trading.model';
import { environment } from '../../environments/environment';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('PortfolioService', () => {
  let service: PortfolioService;
  let httpMock: HttpTestingController;

  const mockPortfolio: PortfolioSummary = {
    cashBalance: 70000,
    availableCash: 70000,
    totalInvested: 30000,
    totalHoldingsMarketValue: 33000,
    totalPortfolioValue: 103000,
    totalUnrealizedPnL: 3000,
    totalUnrealizedPnLPercent: 10.0,
    totalHoldingsCount: 1,
    cashAllocationPercent: 67.96,
    holdings: [
      {
        holdingId: 1,
        symbol: 'RELIANCE',
        companyName: 'Reliance Industries Ltd',
        exchange: 'NSE',
        currency: 'INR',
        quantity: 10,
        averageBuyPrice: 3000,
        totalInvested: 30000,
        currentPrice: 3300,
        currentValue: 33000,
        unrealizedPnL: 3000,
        unrealizedPnLPercent: 10.0,
        allocationPercent: 32.04,
        priceAvailable: true
      }
    ]
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        PortfolioService,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });

    service = TestBed.inject(PortfolioService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
    expect(service.portfolio()).toBeNull();
    expect(service.isLoading()).toBe(false);
    expect(service.error()).toBeNull();
  });

  it('should fetch portfolio summary and update signal', () => {
    service.getPortfolio().subscribe(res => {
      expect(res).toEqual(mockPortfolio);
    });

    expect(service.isLoading()).toBe(true);

    const req = httpMock.expectOne(`${environment.apiUrl}/portfolio`);
    expect(req.request.method).toBe('GET');
    req.flush(mockPortfolio);

    expect(service.portfolio()).toEqual(mockPortfolio);
    expect(service.isLoading()).toBe(false);
    expect(service.error()).toBeNull();
  });

  it('should handle portfolio error and set error signal', () => {
    service.getPortfolio().subscribe({
      error: () => {
        expect(service.error()).toBe('Failed to authenticate portfolio access');
        expect(service.isLoading()).toBe(false);
      }
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/portfolio`);
    req.flush({ message: 'Failed to authenticate portfolio access' }, { status: 401, statusText: 'Unauthorized' });
  });
});
