import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { WatchlistComponent } from './watchlist';
import { WatchlistService } from '../../../services/watchlist.service';
import { MarketService } from '../../../services/market.service';
import { WatchlistResponse, WatchlistItem } from '../../../models/watchlist.model';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('WatchlistComponent', () => {
  let component: WatchlistComponent;
  let watchlistService: WatchlistService;
  let marketService: MarketService;
  let router: Router;

  const mockItem1: WatchlistItem = {
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

  const mockItem2: WatchlistItem = {
    id: 2,
    stockId: 20,
    symbol: 'NIFTY 50',
    companyName: 'Nifty 50 Index',
    exchange: 'NSE',
    currency: 'INR',
    category: 'INDICES',
    currentPrice: 25000,
    change: 120,
    changePercent: '+0.48%',
    previousClose: 24880,
    volume: 500000,
    displayOrder: 1,
    priceAvailable: true,
    lastUpdated: 1727780000000,
    provider: 'Upstox'
  };

  const mockItem3: WatchlistItem = {
    id: 3,
    stockId: 30,
    symbol: 'BTC/USD',
    companyName: 'Bitcoin',
    exchange: 'Twelve Data',
    currency: 'USD',
    category: 'CRYPTO',
    currentPrice: 65000,
    change: -1200,
    changePercent: '-1.81%',
    previousClose: 66200,
    volume: 80000,
    displayOrder: 2,
    priceAvailable: true,
    lastUpdated: 1727780000000,
    provider: 'Twelve Data'
  };

  const mockResponse: WatchlistResponse = {
    items: [mockItem1, mockItem2, mockItem3],
    categories: ['INDICES', 'STOCKS', 'FOREX', 'CRYPTO'],
    totalCount: 3,
    lastRefreshed: 1727780000000
  };

  const mockEmptyResponse: WatchlistResponse = {
    items: [],
    categories: ['INDICES', 'STOCKS', 'FOREX', 'CRYPTO'],
    totalCount: 0,
    lastRefreshed: 1727780000000
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WatchlistComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([])
      ]
    }).compileComponents();

    watchlistService = TestBed.inject(WatchlistService);
    marketService = TestBed.inject(MarketService);
    router = TestBed.inject(Router);

    vi.spyOn(watchlistService, 'getWatchlist').mockImplementation(() => {
      watchlistService.watchlistData.set(mockResponse);
      return of(mockResponse);
    });

    const fixture = TestBed.createComponent(WatchlistComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create WatchlistComponent and load user watchlist on init', () => {
    expect(component).toBeTruthy();
    expect(watchlistService.getWatchlist).toHaveBeenCalled();
    expect(component.filteredItems().length).toBe(3);
  });

  it('should filter items by category tab', () => {
    component.setCategoryFilter('STOCKS');
    expect(component.filteredItems().length).toBe(1);
    expect(component.filteredItems()[0].symbol).toBe('RELIANCE');

    component.setCategoryFilter('INDICES');
    expect(component.filteredItems().length).toBe(1);
    expect(component.filteredItems()[0].symbol).toBe('NIFTY 50');

    component.setCategoryFilter('ALL');
    expect(component.filteredItems().length).toBe(3);
  });

  it('should filter items by search query', () => {
    component.filterQuery.set('bit');
    expect(component.filteredItems().length).toBe(1);
    expect(component.filteredItems()[0].symbol).toBe('BTC/USD');

    component.filterQuery.set('unknown');
    expect(component.filteredItems().length).toBe(0);
  });

  it('should toggle category collapse and expand', () => {
    expect(component.isCategoryCollapsed('STOCKS')).toBe(false);
    component.toggleCategoryCollapse('STOCKS');
    expect(component.isCategoryCollapsed('STOCKS')).toBe(true);
    component.toggleCategoryCollapse('STOCKS');
    expect(component.isCategoryCollapsed('STOCKS')).toBe(false);
  });

  it('should add symbol to watchlist successfully', () => {
    const addSpy = vi.spyOn(watchlistService, 'addToWatchlist').mockReturnValue(of(mockItem1));

    component.addSymbolQuery.set('RELIANCE');
    component.submitAddSymbol();

    expect(addSpy).toHaveBeenCalledWith({ symbol: 'RELIANCE', category: undefined });
    expect(component.addMessage()?.type).toBe('success');
  });

  it('should handle duplicate symbol error gracefully', () => {
    vi.spyOn(watchlistService, 'addToWatchlist').mockReturnValue(
      throwError(() => ({ error: { message: 'Symbol RELIANCE is already in your watchlist' } }))
    );

    component.addSymbolQuery.set('RELIANCE');
    component.submitAddSymbol();

    expect(component.addMessage()?.type).toBe('error');
    expect(component.addMessage()?.text).toContain('already in your watchlist');
  });

  it('should remove item from watchlist', () => {
    const removeSpy = vi.spyOn(watchlistService, 'removeFromWatchlist').mockReturnValue(of({ message: 'Removed' }));
    const event = new MouseEvent('click');

    component.removeItem(mockItem1, event);

    expect(removeSpy).toHaveBeenCalledWith(1);
  });

  it('should navigate to stock details on calling navigateToStock', () => {
    const navigateSpy = vi.spyOn(router, 'navigate');

    component.navigateToStock('RELIANCE');
    expect(navigateSpy).toHaveBeenCalledWith(['/dashboard/stock', 'RELIANCE']);
  });

  it('should render empty watchlist message when items list is empty', () => {
    watchlistService.watchlistData.set(mockEmptyResponse);
    expect(component.filteredItems().length).toBe(0);
  });
});
