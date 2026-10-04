import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TradingService } from './trading.service';
import { TradeRequest, TradeResponse, VirtualWallet, UserHolding, PortfolioSummary } from '../models/trading.model';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('TradingService', () => {
  let service: TradingService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        TradingService,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });

    service = TestBed.inject(TradingService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should execute BUY trade and update wallet signal', () => {
    const request: TradeRequest = { symbol: 'RELIANCE', quantity: 10 };
    const mockResponse: TradeResponse = {
      orderId: 1,
      transactionId: 1,
      symbol: 'RELIANCE',
      companyName: 'Reliance Industries Ltd',
      orderType: 'BUY',
      orderStatus: 'EXECUTED',
      quantity: 10,
      executionPrice: 2950,
      totalAmount: 29500,
      remainingCashBalance: 70500,
      currentHoldingQuantity: 10,
      executedAt: '2026-10-01T03:00:00Z',
      message: 'Successfully bought 10 shares of RELIANCE'
    };

    service.wallet.set({
      cashBalance: 100000,
      totalInvested: 0,
      totalPortfolioValue: 100000,
      currency: 'USD'
    });

    service.buy(request).subscribe((res) => {
      expect(res.orderId).toBe(1);
      expect(res.remainingCashBalance).toBe(70500);
      expect(service.wallet()?.cashBalance).toBe(70500);
    });

    const req = httpMock.expectOne('http://localhost:8080/api/trading/buy');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(request);
    req.flush(mockResponse);

    // Flush automatic post-trade sync requests
    const holdingsReq = httpMock.expectOne('http://localhost:8080/api/trading/holdings');
    holdingsReq.flush([]);

    const portfolioReq = httpMock.expectOne('http://localhost:8080/api/portfolio');
    portfolioReq.flush({ cashBalance: 70500, totalInvested: 29500, totalHoldingsMarketValue: 29500, totalPortfolioValue: 100000, totalUnrealizedPnL: 0, totalUnrealizedPnLPercent: 0, totalHoldingsCount: 1, cashAllocationPercent: 70.5, holdings: [] });

    const symHoldingReq = httpMock.expectOne('http://localhost:8080/api/trading/holdings/RELIANCE');
    symHoldingReq.flush({ holdingId: 1, symbol: 'RELIANCE', companyName: 'Reliance', exchange: 'NSE', currency: 'INR', quantity: 10, averageBuyPrice: 2950, totalInvested: 29500, currentPrice: 2950, currentValue: 29500, unrealizedPnL: 0, unrealizedPnLPercent: 0 });
  });

  it('should execute SELL trade and update wallet signal', () => {
    const request: TradeRequest = { symbol: 'RELIANCE', quantity: 5 };
    const mockResponse: TradeResponse = {
      orderId: 2,
      transactionId: 2,
      symbol: 'RELIANCE',
      companyName: 'Reliance Industries Ltd',
      orderType: 'SELL',
      orderStatus: 'EXECUTED',
      quantity: 5,
      executionPrice: 3000,
      totalAmount: 15000,
      remainingCashBalance: 85500,
      currentHoldingQuantity: 5,
      executedAt: '2026-10-01T03:05:00Z',
      message: 'Successfully sold 5 shares of RELIANCE'
    };

    service.wallet.set({
      cashBalance: 70500,
      totalInvested: 29500,
      totalPortfolioValue: 100000,
      currency: 'USD'
    });

    service.sell(request).subscribe((res) => {
      expect(res.orderId).toBe(2);
      expect(res.remainingCashBalance).toBe(85500);
      expect(service.wallet()?.cashBalance).toBe(85500);
    });

    const req = httpMock.expectOne('http://localhost:8080/api/trading/sell');
    expect(req.request.method).toBe('POST');
    req.flush(mockResponse);

    // Flush automatic post-trade sync requests
    const holdingsReq = httpMock.expectOne('http://localhost:8080/api/trading/holdings');
    holdingsReq.flush([]);

    const portfolioReq = httpMock.expectOne('http://localhost:8080/api/portfolio');
    portfolioReq.flush({ cashBalance: 85500, totalInvested: 14500, totalHoldingsMarketValue: 15000, totalPortfolioValue: 100500, totalUnrealizedPnL: 500, totalUnrealizedPnLPercent: 3.45, totalHoldingsCount: 1, cashAllocationPercent: 85.0, holdings: [] });

    const symHoldingReq = httpMock.expectOne('http://localhost:8080/api/trading/holdings/RELIANCE');
    symHoldingReq.flush({ holdingId: 1, symbol: 'RELIANCE', companyName: 'Reliance', exchange: 'NSE', currency: 'INR', quantity: 5, averageBuyPrice: 2950, totalInvested: 14750, currentPrice: 3000, currentValue: 15000, unrealizedPnL: 250, unrealizedPnLPercent: 1.69 });
  });

  it('should fetch virtual wallet', () => {
    const mockWallet: VirtualWallet = {
      cashBalance: 100000,
      totalInvested: 0,
      totalPortfolioValue: 100000,
      currency: 'USD'
    };

    service.getWallet().subscribe((res) => {
      expect(res.cashBalance).toBe(100000);
      expect(service.wallet()).toEqual(mockWallet);
    });

    const req = httpMock.expectOne('http://localhost:8080/api/trading/wallet');
    expect(req.request.method).toBe('GET');
    req.flush(mockWallet);
  });

  it('should fetch user holding for symbol', () => {
    const mockHolding: UserHolding = {
      holdingId: 1,
      symbol: 'RELIANCE',
      companyName: 'Reliance Industries Ltd',
      exchange: 'NSE',
      currency: 'INR',
      quantity: 10,
      averageBuyPrice: 2950,
      totalInvested: 29500,
      currentPrice: 3000,
      currentValue: 30000,
      unrealizedPnL: 500,
      unrealizedPnLPercent: 1.69
    };

    service.getHoldingForSymbol('RELIANCE').subscribe((res) => {
      expect(res.symbol).toBe('RELIANCE');
      expect(res.quantity).toBe(10);
      expect(service.currentHolding()).toEqual(mockHolding);
    });

    const req = httpMock.expectOne('http://localhost:8080/api/trading/holdings/RELIANCE');
    expect(req.request.method).toBe('GET');
    req.flush(mockHolding);
  });
});

