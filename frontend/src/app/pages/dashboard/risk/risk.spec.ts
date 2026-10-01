import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { RiskComponent } from './risk';
import { RiskService } from '../../../services/risk.service';
import { PortfolioRisk } from '../../../models/risk.model';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('RiskComponent', () => {
  let riskService: RiskService;
  let router: Router;

  const mockActivePortfolioRisk: PortfolioRisk = {
    exposure: {
      totalInvested: 47000,
      equityMarketValue: 50000,
      cashBalance: 50000,
      totalPortfolioValue: 100000,
      equityAllocationPercent: 50,
      cashAllocationPercent: 50,
      var95DailyAmount: 1100,
      var95DailyPercent: 2.2
    },
    annualizedVolatilityPercent: 18.5,
    maxDrawdownPercent: 5.2,
    herfindahlHirschmanIndex: 3500,
    top1HoldingWeightPercent: 60,
    top3HoldingWeightPercent: 100,
    effectiveNumberOfAssets: 1.9,
    diversificationRating: 'Moderately Concentrated',
    portfolioBeta: 0.95,
    benchmarkSymbol: 'NIFTY 50',
    benchmarkAvailable: true,
    holdings: [
      {
        holdingId: 1,
        symbol: 'RELIANCE',
        companyName: 'Reliance Industries Ltd',
        exchange: 'NSE',
        currency: 'INR',
        quantity: 10,
        currentPrice: 3000,
        currentValue: 30000,
        weightPercent: 60,
        annualizedVolatilityPercent: 16.5,
        maxDrawdownPercent: 4.8,
        var95Daily: 660,
        unrealizedPnL: 2000,
        unrealizedPnLPercent: 7.14,
        riskRating: 'Low Risk',
        dataAvailable: true
      }
    ],
    historicalRiskSeries: [
      {
        timestamp: 1727000000,
        date: '2026-09-20',
        portfolioValueIndex: 100,
        drawdownPercent: 0,
        rollingVolatilityPercent: 15
      },
      {
        timestamp: 1727086400,
        date: '2026-09-21',
        portfolioValueIndex: 102,
        drawdownPercent: 0,
        rollingVolatilityPercent: 16
      }
    ],
    calculationTimestamp: 1727690000000,
    dataSource: 'Live Portfolio Holdings & Real Market Data',
    emptyPortfolio: false,
    dataAvailable: true,
    statusMessage: 'Risk analysis complete'
  };

  const mockEmptyPortfolioRisk: PortfolioRisk = {
    ...mockActivePortfolioRisk,
    emptyPortfolio: true,
    holdings: [],
    historicalRiskSeries: []
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RiskComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([])
      ]
    }).compileComponents();

    riskService = TestBed.inject(RiskService);
    router = TestBed.inject(Router);
  });

  it('should create the Risk component and load risk data on init', () => {
    const getRiskSpy = vi.spyOn(riskService, 'getPortfolioRisk').mockReturnValue(of(mockActivePortfolioRisk));

    const fixture = TestBed.createComponent(RiskComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component).toBeTruthy();
    expect(getRiskSpy).toHaveBeenCalled();
    expect(component.riskData()).toEqual(mockActivePortfolioRisk);
  });

  it('should render risk cards and table when portfolio has active holdings', () => {
    vi.spyOn(riskService, 'getPortfolioRisk').mockReturnValue(of(mockActivePortfolioRisk));

    const fixture = TestBed.createComponent(RiskComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.page-title')?.textContent).toContain('Portfolio Risk Management');
    expect(compiled.querySelector('.metrics-grid')).toBeTruthy();
    expect(compiled.querySelector('.risk-table')).toBeTruthy();
    expect(compiled.querySelector('.stock-symbol-text')?.textContent).toContain('RELIANCE');
  });

  it('should render empty portfolio state when emptyPortfolio is true', () => {
    vi.spyOn(riskService, 'getPortfolioRisk').mockReturnValue(of(mockEmptyPortfolioRisk));

    const fixture = TestBed.createComponent(RiskComponent);
    const component = fixture.componentInstance;
    component.loadRiskData();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.empty-portfolio-card')).toBeTruthy();
    expect(compiled.querySelector('.empty-portfolio-card h2')?.textContent).toContain('No Active Equity Holdings');
  });

  it('should handle API error gracefully and display error banner', () => {
    vi.spyOn(riskService, 'getPortfolioRisk').mockReturnValue(
      throwError(() => ({ message: 'Network connection error' }))
    );

    const fixture = TestBed.createComponent(RiskComponent);
    const component = fixture.componentInstance;
    component.loadRiskData();
    fixture.detectChanges();

    expect(component.error()).toBeTruthy();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.error-banner')).toBeTruthy();
  });

  it('should toggle metric views between drawdown, volatility, and combined', () => {
    vi.spyOn(riskService, 'getPortfolioRisk').mockReturnValue(of(mockActivePortfolioRisk));

    const fixture = TestBed.createComponent(RiskComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.setMetricView('drawdown');
    expect(component.selectedMetric()).toBe('drawdown');

    component.setMetricView('volatility');
    expect(component.selectedMetric()).toBe('volatility');

    component.setMetricView('both');
    expect(component.selectedMetric()).toBe('both');
  });

  it('should navigate to stock details on calling navigateToStock', () => {
    vi.spyOn(riskService, 'getPortfolioRisk').mockReturnValue(of(mockActivePortfolioRisk));
    const navigateSpy = vi.spyOn(router, 'navigate');

    const fixture = TestBed.createComponent(RiskComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.navigateToStock('RELIANCE');
    expect(navigateSpy).toHaveBeenCalledWith(['/dashboard/stock', 'RELIANCE']);
  });
});
