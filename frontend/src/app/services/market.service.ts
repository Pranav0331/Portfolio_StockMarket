import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { StockQuote, StockSearchResponse, MarketPrice, CandleSeries } from '../models/market.model';

@Injectable({
  providedIn: 'root'
})
export class MarketService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  private static readonly INDIAN_SYMBOLS = new Set([
    'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'SBIN', 'BHARTIARTL',
    'ITC', 'KOTAKBANK', 'LT', 'HINDUNILVR', 'AXISBANK', 'BAJFINANCE', 'MARUTI',
    'TATAMOTORS', 'TATASTEEL', 'WIPRO', 'ASIANPAINT', 'SUNPHARMA', 'TITAN',
    'ADANIENT', 'ADANIPORTS', 'NTPC', 'POWERGRID', 'ONGC', 'COALINDIA',
    'BAJAJFINSV', 'JSWSTEEL', 'HCLTECH', 'DRREDDY', 'EICHERMOT', 'NESTLEIND',
    'ULTRACEMCO', 'ZOMATO', 'JIOFIN', 'BEL', 'HAL',
    'NIFTY 50', 'NIFTY50', 'NIFTY', 'BANKNIFTY', 'NIFTY BANK', 'FINNIFTY', 'MIDCPNIFTY',
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
   * Fetch real-time market quote for a given ticker/symbol
   * Routes Indian NSE/BSE stocks and indices to Upstox API and US/Forex/Crypto to Twelve Data
   */
  getQuote(symbol: string): Observable<StockQuote> {
    const cleanSymbol = symbol.trim();
    const params = new HttpParams().set('symbol', cleanSymbol);

    if (this.isIndianSymbol(cleanSymbol)) {
      return this.http.get<StockQuote>(`${this.baseUrl}/upstox/quote`, { params });
    }
    return this.http.get<StockQuote>(`${this.baseUrl}/market/quote`, { params });
  }

  /**
   * Fetch real OHLC candlestick series for a symbol and interval
   * Routes Indian NSE/BSE stocks and indices to Upstox API and US/Forex/Crypto to Twelve Data
   */
  getCandles(symbol: string, interval: string = '5min', outputsize: number = 100): Observable<CandleSeries> {
    const cleanSymbol = symbol.trim();
    let params = new HttpParams()
      .set('symbol', cleanSymbol)
      .set('interval', interval.trim());
    if (outputsize) {
      params = params.set('outputsize', outputsize.toString());
    }

    if (this.isIndianSymbol(cleanSymbol)) {
      return this.http.get<CandleSeries>(`${this.baseUrl}/upstox/candles`, { params });
    }
    return this.http.get<CandleSeries>(`${this.baseUrl}/market/candles`, { params });
  }

  /**
   * Fetch real-time forex rate (e.g. symbol=EUR/USD) via Twelve Data
   */
  getForexPrice(symbol: string): Observable<MarketPrice> {
    const params = new HttpParams().set('symbol', symbol.trim());
    return this.http.get<MarketPrice>(`${this.baseUrl}/market/forex`, { params });
  }

  /**
   * Fetch real-time crypto price (e.g. symbol=BTC/USD) via Twelve Data
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
   * Check current Upstox connection status
   */
  getUpstoxStatus(): Observable<any> {
    return this.http.get(`${this.baseUrl}/upstox/status`);
  }
}
