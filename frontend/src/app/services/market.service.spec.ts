import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { MarketService } from './market.service';
import { StockQuote, StockSearchResponse } from '../models/market.model';
import { environment } from '../../environments/environment';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('MarketService', () => {
  let service: MarketService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
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
      symbol: 'RELIANCE.BSE',
      price: 2980.5,
      change: 15.2,
      changePercent: '+0.51%',
      previousClose: 2965.3,
      open: 2970.0,
      high: 2995.0,
      low: 2960.0,
      volume: 1250000,
      latestTradingDay: '2026-09-28'
    };

    service.getQuote('RELIANCE.BSE').subscribe((quote) => {
      expect(quote).toEqual(mockQuote);
      expect(quote.symbol).toBe('RELIANCE.BSE');
      expect(quote.price).toBe(2980.5);
    });

    const req = httpTesting.expectOne(`${environment.apiUrl}/market/quote?symbol=RELIANCE.BSE`);
    expect(req.request.method).toBe('GET');
    req.flush(mockQuote);
  });

  it('should search symbols for given keywords', () => {
    const mockSearch: StockSearchResponse = {
      query: 'Reliance',
      bestMatches: [
        {
          symbol: 'RELIANCE.BSE',
          name: 'Reliance Industries Limited',
          type: 'Equity',
          region: 'India/Bombay',
          currency: 'INR',
          matchScore: '0.9091'
        }
      ]
    };

    service.searchSymbols('Reliance').subscribe((res) => {
      expect(res.bestMatches.length).toBe(1);
      expect(res.bestMatches[0].symbol).toBe('RELIANCE.BSE');
      expect(res.bestMatches[0].name).toBe('Reliance Industries Limited');
    });

    const req = httpTesting.expectOne(`${environment.apiUrl}/market/search?keywords=Reliance`);
    expect(req.request.method).toBe('GET');
    req.flush(mockSearch);
  });
});
