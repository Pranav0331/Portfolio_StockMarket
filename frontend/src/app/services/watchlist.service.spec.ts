import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { WatchlistService } from './watchlist.service';
import { WatchlistResponse, WatchlistItem, AddWatchlistRequest, ReorderWatchlistRequest } from '../models/watchlist.model';
import { environment } from '../../environments/environment';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('WatchlistService', () => {
  let service: WatchlistService;
  let httpMock: HttpTestingController;

  const mockItem: WatchlistItem = {
    id: 1,
    stockId: 10,
    symbol: 'RELIANCE',
    companyName: 'Reliance Industries Ltd',
    exchange: 'NSE',
    currency: 'INR',
    category: 'STOCKS',
    currentPrice: 3000,
    change: 50,
    changePercent: '+1.69%',
    previousClose: 2950,
    volume: 100000,
    displayOrder: 0,
    priceAvailable: true,
    lastUpdated: 1727780000000,
    provider: 'Upstox',
    notes: 'Core holding'
  };

  const mockResponse: WatchlistResponse = {
    items: [mockItem],
    categories: ['INDICES', 'STOCKS', 'FOREX', 'CRYPTO'],
    totalCount: 1,
    lastRefreshed: 1727780000000
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        WatchlistService,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });

    service = TestBed.inject(WatchlistService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created and initialize signals', () => {
    expect(service).toBeTruthy();
    expect(service.watchlistData()).toBeNull();
    expect(service.isLoading()).toBe(false);
    expect(service.error()).toBeNull();
  });

  it('should fetch watchlist and update signal', () => {
    service.getWatchlist().subscribe((res) => {
      expect(res).toEqual(mockResponse);
    });

    expect(service.isLoading()).toBe(true);

    const req = httpMock.expectOne(`${environment.apiUrl}/watchlist`);
    expect(req.request.method).toBe('GET');
    req.flush(mockResponse);

    expect(service.isLoading()).toBe(false);
    expect(service.watchlistData()).toEqual(mockResponse);
    expect(service.error()).toBeNull();
  });

  it('should add item to watchlist and trigger reload', () => {
    const addReq: AddWatchlistRequest = { symbol: 'AAPL', category: 'STOCKS' };

    service.addToWatchlist(addReq).subscribe((item) => {
      expect(item.symbol).toBe('AAPL');
    });

    const reqPost = httpMock.expectOne(`${environment.apiUrl}/watchlist`);
    expect(reqPost.request.method).toBe('POST');
    reqPost.flush({ ...mockItem, id: 2, symbol: 'AAPL' });

    const reqGet = httpMock.expectOne(`${environment.apiUrl}/watchlist`);
    expect(reqGet.request.method).toBe('GET');
    reqGet.flush(mockResponse);
  });

  it('should remove item from watchlist by id and trigger reload', () => {
    service.removeFromWatchlist(1).subscribe((res) => {
      expect(res.message).toBe('Item successfully removed');
    });

    const reqDelete = httpMock.expectOne(`${environment.apiUrl}/watchlist/1`);
    expect(reqDelete.request.method).toBe('DELETE');
    reqDelete.flush({ message: 'Item successfully removed' });

    const reqGet = httpMock.expectOne(`${environment.apiUrl}/watchlist`);
    expect(reqGet.request.method).toBe('GET');
    reqGet.flush(mockResponse);
  });

  it('should reorder watchlist items', () => {
    const reorderReq: ReorderWatchlistRequest = { orderedIds: [2, 1] };

    service.reorderWatchlist(reorderReq).subscribe((res) => {
      expect(res.message).toBe('Order updated');
    });

    const reqPut = httpMock.expectOne(`${environment.apiUrl}/watchlist/reorder`);
    expect(reqPut.request.method).toBe('PUT');
    reqPut.flush({ message: 'Order updated' });
  });

  it('should check if symbol is in watchlist', () => {
    service.checkInWatchlist('RELIANCE').subscribe((res) => {
      expect(res.inWatchlist).toBe(true);
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/watchlist/check/RELIANCE`);
    expect(req.request.method).toBe('GET');
    req.flush({ inWatchlist: true });
  });
});
