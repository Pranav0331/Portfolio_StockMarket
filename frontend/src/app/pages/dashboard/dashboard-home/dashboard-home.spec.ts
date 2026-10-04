import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DashboardHomeComponent } from './dashboard-home';
import { AuthService } from '../../../services/auth.service';
import { PortfolioService } from '../../../services/portfolio.service';
import { TransactionService } from '../../../services/transaction.service';
import { OrderService } from '../../../services/order.service';
import { WatchlistService } from '../../../services/watchlist.service';
import { TradingService } from '../../../services/trading.service';
import { PortfolioSummary, VirtualWallet } from '../../../models/trading.model';
import { WatchlistResponse } from '../../../models/watchlist.model';

describe('DashboardHomeComponent', () => {
  let authService: AuthService;
  let portfolioService: PortfolioService;
  let transactionService: TransactionService;
  let orderService: OrderService;
  let watchlistService: WatchlistService;
  let tradingService: TradingService;
  let router: Router;

  const mockPortfolio: PortfolioSummary = {
    cashBalance: 25000.00,
    availableCash: 25000.00,
    totalInvested: 90000.00,
    totalHoldingsMarketValue: 100000.50,
    totalPortfolioValue: 125000.50,
    totalUnrealizedPnL: 10000.50,
    totalUnrealizedPnLPercent: 11.11,
    todayPnL: 1250.00,
    todayPnLPercent: 1.01,
    totalHoldingsCount: 1,
    cashAllocationPercent: 20.0,
    holdings: [
      {
        holdingId: 1,
        symbol: 'AAPL',
        companyName: 'Apple Inc.',
        quantity: 10,
        averageBuyPrice: 150.00,
        currentPrice: 175.00,
        currentValue: 1750.00,
        totalInvested: 1500.00,
        unrealizedPnL: 250.00,
        unrealizedPnLPercent: 16.67,
        allocationPercent: 1.4,
        exchange: 'NASDAQ',
        currency: 'USD',
        priceAvailable: true
      }
    ]
  };

  const mockWallet: VirtualWallet = {
    cashBalance: 25000.00,
    totalInvested: 90000.00,
    totalPortfolioValue: 125000.50,
    currency: 'USD'
  };

  const mockWatchlistResponse: WatchlistResponse = {
    items: [
      {
        id: 1,
        stockId: 10,
        symbol: 'BTC/USD',
        companyName: 'Bitcoin / US Dollar',
        exchange: 'CRYPTO',
        currency: 'USD',
        category: 'Crypto',
        currentPrice: 65000.00,
        change: 2100.00,
        changePercent: '3.50%',
        previousClose: 62900.00,
        volume: 12000,
        displayOrder: 1,
        priceAvailable: true,
        lastUpdated: Date.now(),
        provider: 'TwelveData'
      }
    ],
    categories: ['Crypto'],
    totalCount: 1,
    lastRefreshed: Date.now()
  };

  const mockEmptyWatchlistResponse: WatchlistResponse = {
    items: [],
    categories: [],
    totalCount: 0,
    lastRefreshed: Date.now()
  };

  beforeEach(async () => {
    localStorage.clear();

    await TestBed.configureTestingModule({
      imports: [DashboardHomeComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([])
      ]
    }).compileComponents();

    authService = TestBed.inject(AuthService);
    portfolioService = TestBed.inject(PortfolioService);
    transactionService = TestBed.inject(TransactionService);
    orderService = TestBed.inject(OrderService);
    watchlistService = TestBed.inject(WatchlistService);
    tradingService = TestBed.inject(TradingService);
    router = TestBed.inject(Router);
  });

  it('should create the dashboard home component and load data', () => {
    vi.spyOn(portfolioService, 'getPortfolio').mockReturnValue(of(mockPortfolio));
    vi.spyOn(tradingService, 'getWallet').mockReturnValue(of(mockWallet));
    vi.spyOn(transactionService, 'getTransactions').mockReturnValue(of({
      content: [
        {
          transactionId: 'TX101',
          symbol: 'AAPL',
          type: 'BUY',
          quantity: 10,
          executionPrice: 150.00,
          totalAmount: 1500.00,
          status: 'EXECUTED',
          executedAt: new Date().toISOString()
        }
      ],
      totalElements: 1,
      totalPages: 1,
      size: 5,
      number: 0
    } as any));
    vi.spyOn(orderService, 'getOrders').mockReturnValue(of({
      content: [
        {
          id: 1,
          symbol: 'AAPL',
          type: 'BUY',
          orderType: 'MARKET',
          quantity: 10,
          price: 150.00,
          status: 'EXECUTED',
          createdAt: new Date().toISOString()
        }
      ],
      totalElements: 1,
      totalPages: 1,
      size: 5,
      number: 0
    } as any));
    vi.spyOn(watchlistService, 'getWatchlist').mockReturnValue(of(mockWatchlistResponse));

    const fixture = TestBed.createComponent(DashboardHomeComponent);
    const comp = fixture.componentInstance;
    fixture.detectChanges();

    expect(comp).toBeTruthy();
    expect(comp.portfolio()?.totalPortfolioValue).toBe(125000.50);
    expect(comp.holdings().length).toBe(1);
    expect(comp.recentTransactions().length).toBe(1);
    expect(comp.recentOrders().length).toBe(1);
    expect(comp.watchlist().length).toBe(1);
  });

  it('should render welcome heading and metric cards', async () => {
    authService.setSession({
      id: 2,
      name: 'Charlie Munger',
      email: 'charlie@berkshire.com'
    });

    vi.spyOn(portfolioService, 'getPortfolio').mockReturnValue(of(mockPortfolio));
    vi.spyOn(tradingService, 'getWallet').mockReturnValue(of(mockWallet));
    vi.spyOn(transactionService, 'getTransactions').mockReturnValue(of({ content: [] } as any));
    vi.spyOn(orderService, 'getOrders').mockReturnValue(of({ content: [] } as any));
    vi.spyOn(watchlistService, 'getWatchlist').mockReturnValue(of(mockEmptyWatchlistResponse));

    const fixture = TestBed.createComponent(DashboardHomeComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.welcome-heading')?.textContent).toContain('Charlie Munger');
    const metricCards = compiled.querySelectorAll('.metric-card');
    expect(metricCards.length).toBe(4);

    expect(compiled.querySelector('.holdings-card')).toBeTruthy();
    expect(compiled.querySelector('.transactions-card')).toBeTruthy();
    expect(compiled.querySelector('.watchlist-card')).toBeTruthy();
    expect(compiled.querySelector('.orders-card')).toBeTruthy();
  });

  it('should open and close manage paper balance modal', () => {
    const fixture = TestBed.createComponent(DashboardHomeComponent);
    const comp = fixture.componentInstance;

    expect(comp.showManageBalanceModal()).toBe(false);
    comp.openManageBalanceModal('deposit');
    expect(comp.showManageBalanceModal()).toBe(true);
    expect(comp.balanceActionTab()).toBe('deposit');

    comp.closeManageBalanceModal();
    expect(comp.showManageBalanceModal()).toBe(false);
  });

  it('should deposit virtual paper balance funds', () => {
    const depositSpy = vi.spyOn(tradingService, 'depositCash').mockReturnValue(of(mockWallet));

    const fixture = TestBed.createComponent(DashboardHomeComponent);
    const comp = fixture.componentInstance;

    comp.openManageBalanceModal('deposit');
    comp.depositAmount.set(5000);
    comp.submitDeposit();

    expect(depositSpy).toHaveBeenCalledWith(5000);
  });

  it('should reset virtual paper balance', () => {
    const resetSpy = vi.spyOn(tradingService, 'resetCashBalance').mockReturnValue(of(mockWallet));

    const fixture = TestBed.createComponent(DashboardHomeComponent);
    const comp = fixture.componentInstance;

    comp.openManageBalanceModal('reset');
    comp.resetTargetAmount.set(100000);
    comp.submitReset();

    expect(resetSpy).toHaveBeenCalledWith(100000);
  });

  it('should navigate to stock details on symbol click', () => {
    const navigateSpy = vi.spyOn(router, 'navigate');

    const fixture = TestBed.createComponent(DashboardHomeComponent);
    const comp = fixture.componentInstance;

    comp.navigateToStock('AAPL');
    expect(navigateSpy).toHaveBeenCalledWith(['/dashboard/stock', 'AAPL']);
  });
});
