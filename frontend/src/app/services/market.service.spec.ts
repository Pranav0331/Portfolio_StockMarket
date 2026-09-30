import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { MarketService } from './market.service';
import { StockQuote, StockSearchResponse, MarketPrice } from '../models/market.model';
import { environment } from '../../environments/environment';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('MarketService', () => {
  let service: MarketService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        MarketService,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });

    service = TestBed.inject(MarketService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should fetch stock quote for given symbol', () => {
    const mockQuote: StockQuote = {
      symbol: 'AAPL',
      price: 185.5,
      change: 2.2,
      changePercent: '+1.20%',
      previousClose: 183.3,
      open: 184.0,
      high: 186.0,
      low: 183.5,
      volume: 45000000,
      latestTradingDay: '2026-09-28',
      timestamp: 1727500000
    };

    service.getQuote('AAPL').subscribe((quote) => {
      expect(quote).toEqual(mockQuote);
      expect(quote.symbol).toBe('AAPL');
      expect(quote.price).toBe(185.5);
    });

    const req = httpTesting.expectOne((r) => r.url === `${environment.apiUrl}/market/quote` && r.params.get('symbol') === 'AAPL');
    expect(req.request.method).toBe('GET');
    req.flush(mockQuote);
  });

  it('should fetch forex price for given symbol', () => {
    const mockPrice: MarketPrice = {
      symbol: 'EUR/USD',
      price: 1.085,
      change: 0.0012,
      changePercent: '+0.11%',
      timestamp: 1727500000
    };

    service.getForexPrice('EUR/USD').subscribe((price) => {
      expect(price).toEqual(mockPrice);
      expect(price.symbol).toBe('EUR/USD');
      expect(price.price).toBe(1.085);
    });

    const req = httpTesting.expectOne((r) => r.url === `${environment.apiUrl}/market/forex` && r.params.get('symbol') === 'EUR/USD');
    expect(req.request.method).toBe('GET');
    req.flush(mockPrice);
  });

  it('should fetch crypto price for given symbol', () => {
    const mockPrice: MarketPrice = {
      symbol: 'BTC/USD',
      price: 65000.0,
      change: 1200.0,
      changePercent: '+1.88%',
      timestamp: 1727500000
    };

    service.getCryptoPrice('BTC/USD').subscribe((price) => {
      expect(price).toEqual(mockPrice);
      expect(price.symbol).toBe('BTC/USD');
      expect(price.price).toBe(65000.0);
    });

    const req = httpTesting.expectOne((r) => r.url === `${environment.apiUrl}/market/crypto` && r.params.get('symbol') === 'BTC/USD');
    expect(req.request.method).toBe('GET');
    req.flush(mockPrice);
  });

  it('should search symbols for given keywords', () => {
    const mockSearch: StockSearchResponse = {
      query: 'Apple',
      bestMatches: [
        {
          symbol: 'AAPL',
          name: 'Apple Inc.',
          type: 'Equity',
          region: 'United States',
          currency: 'USD',
          matchScore: '0.95'
        }
      ]
    };

    service.searchSymbols('Apple').subscribe((res) => {
      expect(res.bestMatches.length).toBe(1);
      expect(res.bestMatches[0].symbol).toBe('AAPL');
      expect(res.bestMatches[0].name).toBe('Apple Inc.');
    });

    const req = httpTesting.expectOne((r) => r.url === `${environment.apiUrl}/market/search` && r.params.get('keywords') === 'Apple');
    expect(req.request.method).toBe('GET');
    req.flush(mockSearch);
  });
});
