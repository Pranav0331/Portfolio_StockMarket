import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { PortfolioComponent } from './portfolio';
import { PortfolioService } from '../../../services/portfolio.service';
import { TradingService } from '../../../services/trading.service';
import { PortfolioSummary } from '../../../models/trading.model';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('PortfolioComponent', () => {
  let portfolioService: PortfolioService;
  let router: Router;

  const mockPortfolio: PortfolioSummary = {
    cashBalance: 55000,
    availableCash: 55000,
    totalInvested: 45000,
    totalHoldingsMarketValue: 48500,
    totalPortfolioValue: 103500,
    totalUnrealizedPnL: 3500,
    totalUnrealizedPnLPercent: 7.78,
    totalHoldingsCount: 2,
    cashAllocationPercent: 53.14,
    holdings: [
      {
        holdingId: 10,
        symbol: 'RELIANCE',
        companyName: 'Reliance Industries Ltd',
        exchange: 'NSE',
        currency: 'INR',
        quantity: 10,
        averageBuyPrice: 2900,
        totalInvested: 29000,
        currentPrice: 3100,
        currentValue: 31000,
        unrealizedPnL: 2000,
        unrealizedPnLPercent: 6.9,
        allocationPercent: 29.95,
        priceAvailable: true
      },
      {
        holdingId: 11,
        symbol: 'AAPL',
        companyName: 'Apple Inc.',
        exchange: 'NASDAQ',
        currency: 'USD',
        quantity: 75,
        averageBuyPrice: 213.33,
        totalInvested: 16000,
        currentPrice: 233.33,
        currentValue: 17500,
        unrealizedPnL: 1500,
        unrealizedPnLPercent: 9.38,
        allocationPercent: 16.91,
        priceAvailable: true
      }
    ]
  };

  const mockEmptyPortfolio: PortfolioSummary = {
    cashBalance: 100000,
    availableCash: 100000,
    totalInvested: 0,
    totalHoldingsMarketValue: 0,
    totalPortfolioValue: 100000,
    totalUnrealizedPnL: 0,
    totalUnrealizedPnLPercent: 0,
    totalHoldingsCount: 0,
    cashAllocationPercent: 100,
    holdings: []
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PortfolioComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([])
      ]
    }).compileComponents();

    portfolioService = TestBed.inject(PortfolioService);
    router = TestBed.inject(Router);
  });

  it('should create the PortfolioComponent and load portfolio on init', () => {
    const getPortfolioSpy = vi.spyOn(portfolioService, 'getPortfolio').mockReturnValue(of(mockPortfolio));

    const fixture = TestBed.createComponent(PortfolioComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component).toBeTruthy();
    expect(getPortfolioSpy).toHaveBeenCalled();
    expect(component.portfolio()).toEqual(mockPortfolio);
    expect(component.isLoading()).toBe(false);
    expect(component.error()).toBeNull();
  });

  it('should display correct portfolio summary calculations', () => {
    vi.spyOn(portfolioService, 'getPortfolio').mockReturnValue(of(mockPortfolio));

    const fixture = TestBed.createComponent(PortfolioComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    const p = component.portfolio()!;
    expect(p.totalPortfolioValue).toBe(103500);
    expect(p.availableCash).toBe(55000);
    expect(p.totalInvested).toBe(45000);
    expect(p.totalUnrealizedPnL).toBe(3500);
    expect(p.totalUnrealizedPnLPercent).toBe(7.78);
    expect(p.totalHoldingsCount).toBe(2);
    expect(p.cashAllocationPercent).toBe(53.14);
    expect(p.holdings.length).toBe(2);
  });

  it('should handle empty portfolio state with 0 holdings', () => {
    vi.spyOn(portfolioService, 'getPortfolio').mockReturnValue(of(mockEmptyPortfolio));

    const fixture = TestBed.createComponent(PortfolioComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.portfolio()?.holdings.length).toBe(0);
    expect(component.portfolio()?.cashAllocationPercent).toBe(100);
    expect(component.portfolio()?.totalPortfolioValue).toBe(100000);
  });

  it('should navigate to stock details when clicking a holding or trade button', () => {
    vi.spyOn(portfolioService, 'getPortfolio').mockReturnValue(of(mockPortfolio));
    const navigateSpy = vi.spyOn(router, 'navigate');

    const fixture = TestBed.createComponent(PortfolioComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.navigateToStock('RELIANCE');
    expect(navigateSpy).toHaveBeenCalledWith(['/dashboard/stock', 'RELIANCE']);

    component.navigateToStock('AAPL');
    expect(navigateSpy).toHaveBeenCalledWith(['/dashboard/stock', 'AAPL']);
  });

  it('should handle unavailable market price gracefully in holding data', () => {
    const portfolioWithUnavailablePrice: PortfolioSummary = {
      ...mockPortfolio,
      holdings: [
        {
          holdingId: 12,
          symbol: 'UNKNOWN',
          companyName: 'Unknown Corp',
          exchange: 'NASDAQ',
          currency: 'USD',
          quantity: 10,
          averageBuyPrice: 100,
          totalInvested: 1000,
          currentPrice: null,
          currentValue: null,
          unrealizedPnL: null,
          unrealizedPnLPercent: null,
          allocationPercent: 0,
          priceAvailable: false
        }
      ]
    };

    vi.spyOn(portfolioService, 'getPortfolio').mockReturnValue(of(portfolioWithUnavailablePrice));

    const fixture = TestBed.createComponent(PortfolioComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.portfolio()?.holdings[0].priceAvailable).toBe(false);
    expect(component.portfolio()?.holdings[0].currentPrice).toBeNull();
  });

  it('should handle error when loading portfolio fails', () => {
    vi.spyOn(portfolioService, 'getPortfolio').mockReturnValue(
      throwError(() => ({ error: { message: 'Server communication error' } }))
    );

    const fixture = TestBed.createComponent(PortfolioComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.error()).toBe('Server communication error');
  });

  it('should refresh portfolio on calling loadPortfolio', () => {
    const getPortfolioSpy = vi.spyOn(portfolioService, 'getPortfolio').mockReturnValue(of(mockPortfolio));

    const fixture = TestBed.createComponent(PortfolioComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(getPortfolioSpy).toHaveBeenCalledTimes(1);

    component.loadPortfolio();
    expect(getPortfolioSpy).toHaveBeenCalledTimes(2);
  });

  it('should open and close paper balance modal', () => {
    const fixture = TestBed.createComponent(PortfolioComponent);
    const component = fixture.componentInstance;

    expect(component.showManageBalanceModal()).toBe(false);
    component.openManageBalanceModal('deposit');
    expect(component.showManageBalanceModal()).toBe(true);
    expect(component.balanceActionTab()).toBe('deposit');

    component.closeManageBalanceModal();
    expect(component.showManageBalanceModal()).toBe(false);
  });

  it('should deposit cash and reset balance', () => {
    const tradingService = TestBed.inject(TradingService);
    const depositSpy = vi.spyOn(tradingService, 'depositCash').mockReturnValue(of({
      cashBalance: 65000,
      totalInvested: 45000,
      totalPortfolioValue: 110000,
      currency: 'USD'
    }));
    const resetSpy = vi.spyOn(tradingService, 'resetCashBalance').mockReturnValue(of({
      cashBalance: 100000,
      totalInvested: 45000,
      totalPortfolioValue: 145000,
      currency: 'USD'
    }));

    const fixture = TestBed.createComponent(PortfolioComponent);
    const component = fixture.componentInstance;

    component.openManageBalanceModal('deposit');
    component.depositAmount.set(10000);
    component.submitDeposit();
    expect(depositSpy).toHaveBeenCalledWith(10000);

    component.openManageBalanceModal('reset');
    component.resetTargetAmount.set(100000);
    component.submitReset();
    expect(resetSpy).toHaveBeenCalledWith(100000);
  });
});
