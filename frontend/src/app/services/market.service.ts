import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { StockQuote, StockSearchResponse } from '../models/market.model';

@Injectable({
  providedIn: 'root'
})
export class MarketService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  /**
   * Fetch real-time market quote for a given ticker/symbol (e.g., RELIANCE.BSE, IBM, AAPL)
   */
  getQuote(symbol: string): Observable<StockQuote> {
    const params = new HttpParams().set('symbol', symbol.trim());
    return this.http.get<StockQuote>(`${this.baseUrl}/market/quote`, { params });
  }

  /**
   * Search market symbols matching query keywords
   */
  searchSymbols(keywords: string): Observable<StockSearchResponse> {
    const params = new HttpParams().set('keywords', keywords.trim());
    return this.http.get<StockSearchResponse>(`${this.baseUrl}/market/search`, { params });
  }
}
