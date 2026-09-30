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

  /**
   * Fetch real-time market quote for a given ticker/symbol (e.g., AAPL, RELIANCE, EUR/USD, BTC/USD)
   */
  getQuote(symbol: string): Observable<StockQuote> {
    const params = new HttpParams().set('symbol', symbol.trim());
    return this.http.get<StockQuote>(`${this.baseUrl}/market/quote`, { params });
  }

  /**
   * Fetch real OHLC candlestick series for a symbol and interval (e.g., AAPL, 5min)
   */
  getCandles(symbol: string, interval: string = '5min', outputsize: number = 100): Observable<CandleSeries> {
    let params = new HttpParams()
      .set('symbol', symbol.trim())
      .set('interval', interval.trim());
    if (outputsize) {
      params = params.set('outputsize', outputsize.toString());
    }
    return this.http.get<CandleSeries>(`${this.baseUrl}/market/candles`, { params });
  }

  /**
   * Fetch real-time forex rate (e.g. symbol=EUR/USD)
   */
  getForexPrice(symbol: string): Observable<MarketPrice> {
    const params = new HttpParams().set('symbol', symbol.trim());
    return this.http.get<MarketPrice>(`${this.baseUrl}/market/forex`, { params });
  }

  /**
   * Fetch real-time crypto price (e.g. symbol=BTC/USD)
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
}
