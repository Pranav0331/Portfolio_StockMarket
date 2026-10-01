import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  WatchlistResponse,
  WatchlistItem,
  AddWatchlistRequest,
  ReorderWatchlistRequest
} from '../models/watchlist.model';

@Injectable({
  providedIn: 'root'
})
export class WatchlistService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  readonly watchlistData = signal<WatchlistResponse | null>(null);
  readonly isLoading = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  getWatchlist(): Observable<WatchlistResponse> {
    this.isLoading.set(true);
    this.error.set(null);

    return this.http.get<WatchlistResponse>(`${this.baseUrl}/watchlist`).pipe(
      tap({
        next: (data) => {
          this.watchlistData.set(data);
          this.isLoading.set(false);
          this.error.set(null);
        },
        error: (err) => {
          this.isLoading.set(false);
          const errorMsg = err?.error?.message || err?.message || 'Failed to load watchlist. Please try again.';
          this.error.set(errorMsg);
        }
      })
    );
  }

  addToWatchlist(request: AddWatchlistRequest): Observable<WatchlistItem> {
    return this.http.post<WatchlistItem>(`${this.baseUrl}/watchlist`, request).pipe(
      tap({
        next: () => {
          this.getWatchlist().subscribe();
        }
      })
    );
  }

  removeFromWatchlist(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.baseUrl}/watchlist/${id}`).pipe(
      tap({
        next: () => {
          this.getWatchlist().subscribe();
        }
      })
    );
  }

  removeFromWatchlistBySymbol(symbol: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.baseUrl}/watchlist/symbol/${encodeURIComponent(symbol)}`).pipe(
      tap({
        next: () => {
          this.getWatchlist().subscribe();
        }
      })
    );
  }

  reorderWatchlist(request: ReorderWatchlistRequest): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${this.baseUrl}/watchlist/reorder`, request);
  }

  checkInWatchlist(symbol: string): Observable<{ inWatchlist: boolean }> {
    return this.http.get<{ inWatchlist: boolean }>(`${this.baseUrl}/watchlist/check/${encodeURIComponent(symbol)}`);
  }
}
