import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams, HttpErrorResponse } from '@angular/common/http';
import { Observable, of, throwError, timer } from 'rxjs';
import { shareReplay, finalize, tap, retry, catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { StockQuote, StockSearchResponse, MarketPrice, CandleSeries, FundamentalData } from '../models/market.model';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

@Injectable({
  providedIn: 'root'
})
export class MarketService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  private static readonly CACHE_TTL_MS = 60000; // 60s cache TTL for historical data

  // In-flight request deduplication maps
  private readonly inFlightCandles = new Map<string, Observable<CandleSeries>>();
  private readonly inFlightQuotes = new Map<string, Observable<StockQuote>>();

  // In-memory response caches
  private readonly candleCache = new Map<string, CacheEntry<CandleSeries>>();
  private readonly quoteCache = new Map<string, CacheEntry<StockQuote>>();

  private static readonly INDIAN_SYMBOLS = new Set([
    'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'SBIN', 'BHARTIARTL',
    'ITC', 'KOTAKBANK', 'LT', 'HINDUNILVR', 'AXISBANK', 'BAJFINANCE', 'MARUTI',
    'TATAMOTORS', 'TATASTEEL', 'WIPRO', 'ASIANPAINT', 'SUNPHARMA', 'TITAN',
    'ADANIENT', 'ADANIPORTS', 'NTPC', 'POWERGRID', 'ONGC', 'COALINDIA',
    'BAJAJFINSV', 'JSWSTEEL', 'HCLTECH', 'DRREDDY', 'EICHERMOT', 'NESTLEIND',
    'ULTRACEMCO', 'ZOMATO', 'JIOFIN', 'BEL', 'HAL',
    'NIFTY 50', 'NIFTY50', 'NIFTY', 'BANKNIFTY', 'NIFTY BANK', 'BANK NIFTY',
    'NIFTY IT', 'NIFTY AUTO', 'NIFTY FIN SERVICE', 'FINNIFTY', 'MIDCPNIFTY',
    'SENSEX', 'BSESENSEX'
  ]);

  /**
   * Determine if a symbol represents an Indian equity or index
   */
  isIndianSymbol(symbol: string): boolean {
    if (!symbol) return false;
    const clean = symbol.trim().toUpperCase();
    return (
      clean.endsWith('.NSE') ||
      clean.endsWith('.BSE') ||
      clean.startsWith('NSE_') ||
      clean.startsWith('BSE_') ||
      clean.startsWith('NSE:') ||
      clean.startsWith('BSE:') ||
      clean.includes('|') ||
      MarketService.INDIAN_SYMBOLS.has(clean)
    );
  }

  /**
   * Fetch real-time market quote for a given ticker/symbol with deduplication and caching
   */
  getQuote(symbol: string, forceRefresh = false): Observable<StockQuote> {
    if (!symbol) {
      return throwError(() => new Error('Symbol is required'));
    }

    const cleanSymbol = symbol.trim().toUpperCase();
    const cacheKey = `quote_${cleanSymbol}`;

    // 1. Check in-memory cache
    if (!forceRefresh) {
      const cached = this.quoteCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp < MarketService.CACHE_TTL_MS)) {
        return of(cached.data);
      }
    }

    // 2. Check in-flight deduplication
    const existing = this.inFlightQuotes.get(cacheKey);
    if (existing) {
      return existing;
    }

    const params = new HttpParams().set('symbol', cleanSymbol);
    const url = this.isIndianSymbol(cleanSymbol)
      ? `${this.baseUrl}/upstox/quote`
      : `${this.baseUrl}/market/quote`;

    const request$ = this.http.get<StockQuote>(url, { params }).pipe(
      retry({
        count: 1,
        delay: (err: HttpErrorResponse) => {
          // NEVER retry 429 rate limit or 404
          if (err.status === 429 || err.status === 404 || err.status === 400) {
            return throwError(() => err);
          }
          return timer(1500);
        }
      }),
      tap((quote) => {
        if (quote && quote.price != null) {
          this.quoteCache.set(cacheKey, { data: quote, timestamp: Date.now() });
        }
      }),
      finalize(() => {
        this.inFlightQuotes.delete(cacheKey);
      }),
      shareReplay(1)
    );

    this.inFlightQuotes.set(cacheKey, request$);
    return request$;
  }

  /**
   * Fetch real OHLC candlestick series for a symbol and interval with deduplication and caching
   */
  getCandles(symbol: string, interval: string = '5min', outputsize: number = 100, forceRefresh = false): Observable<CandleSeries> {
    if (!symbol) {
      return throwError(() => new Error('Symbol is required'));
    }

    const cleanSymbol = symbol.trim().toUpperCase();
    const cleanInterval = interval.trim().toLowerCase();
    const size = outputsize || 100;
    const cacheKey = `candles_${cleanSymbol}_${cleanInterval}_${size}`;

    // 1. Check in-memory cache
    if (!forceRefresh) {
      const cached = this.candleCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp < MarketService.CACHE_TTL_MS)) {
        return of(cached.data);
      }
    }

    // 2. Check in-flight deduplication
    const existing = this.inFlightCandles.get(cacheKey);
    if (existing) {
      return existing;
    }

    let params = new HttpParams()
      .set('symbol', cleanSymbol)
      .set('interval', cleanInterval)
      .set('outputsize', size.toString());

    const url = this.isIndianSymbol(cleanSymbol)
      ? `${this.baseUrl}/upstox/candles`
      : `${this.baseUrl}/market/candles`;

    const request$ = this.http.get<CandleSeries>(url, { params }).pipe(
      retry({
        count: 1,
        delay: (err: HttpErrorResponse) => {
          // NEVER retry 429 rate limit or 404
          if (err.status === 429 || err.status === 404 || err.status === 400) {
            return throwError(() => err);
          }
          return timer(1500);
        }
      }),
      tap((series) => {
        if (series && series.candles && series.candles.length > 0) {
          this.candleCache.set(cacheKey, { data: series, timestamp: Date.now() });
        }
      }),
      finalize(() => {
        this.inFlightCandles.delete(cacheKey);
      }),
      shareReplay(1)
    );

    this.inFlightCandles.set(cacheKey, request$);
    return request$;
  }

  /**
   * Fetch real-time forex rate via Twelve Data
   */
  getForexPrice(symbol: string): Observable<MarketPrice> {
    const params = new HttpParams().set('symbol', symbol.trim());
    return this.http.get<MarketPrice>(`${this.baseUrl}/market/forex`, { params });
  }

  /**
   * Fetch real-time crypto price via Twelve Data
   */
  getCryptoPrice(symbol: string): Observable<MarketPrice> {
    const params = new HttpParams().set('symbol', symbol.trim());
    return this.http.get<MarketPrice>(`${this.baseUrl}/market/crypto`, { params });
  }

  /**
   * Search market symbols matching query keywords
   */
  searchSymbols(keywords: string): Observable<StockSearchResponse> {
    const params = new HttpParams().set('keywords', keywords.trim());
    return this.http.get<StockSearchResponse>(`${this.baseUrl}/market/search`, { params });
  }

  /**
   * Fetch fundamental data and company overview from Spring Boot backend
   */
  getFundamentals(symbol: string): Observable<FundamentalData> {
    const cleanSymbol = symbol.trim().toUpperCase();
    const params = new HttpParams().set('symbol', cleanSymbol);
    return this.http.get<FundamentalData>(`${this.baseUrl}/market/fundamentals`, { params });
  }

  /**
   * Check current Upstox connection status
   */
  getUpstoxStatus(): Observable<any> {
    return this.http.get(`${this.baseUrl}/upstox/status`);
  }

  /**
   * Clear all in-memory caches
   */
  clearCaches(): void {
    this.candleCache.clear();
    this.quoteCache.clear();
  }
}
