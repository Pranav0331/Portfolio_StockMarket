import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { RiskService } from './risk.service';
import { PortfolioRisk } from '../models/risk.model';
import { environment } from '../../environments/environment';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('RiskService', () => {
  let service: RiskService;
  let httpMock: HttpTestingController;

  const mockRiskData: PortfolioRisk = {
    exposure: {
      totalInvested: 50000,
      equityMarketValue: 55000,
      cashBalance: 45000,
      totalPortfolioValue: 100000,
      equityAllocationPercent: 55,
      cashAllocationPercent: 45,
      var95DailyAmount: 1200,
      var95DailyPercent: 2.18
    },
    annualizedVolatilityPercent: 18.5,
    maxDrawdownPercent: 6.4,
    herfindahlHirschmanIndex: 3500,
    top1HoldingWeightPercent: 60,
    top3HoldingWeightPercent: 100,
    effectiveNumberOfAssets: 1.8,
    diversificationRating: 'Moderately Concentrated',
    portfolioBeta: 0.92,
    benchmarkSymbol: 'NIFTY 50',
    benchmarkAvailable: true,
    holdings: [],
    historicalRiskSeries: [],
    calculationTimestamp: 1727690000000,
    dataSource: 'Real Market Data',
    emptyPortfolio: false,
    dataAvailable: true,
    statusMessage: 'Risk analysis complete'
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        RiskService,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });

    service = TestBed.inject(RiskService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
    expect(service.riskData()).toBeNull();
    expect(service.isLoading()).toBe(false);
    expect(service.error()).toBeNull();
  });

  it('should fetch portfolio risk data and update signals', () => {
    service.getPortfolioRisk().subscribe((data) => {
      expect(data).toEqual(mockRiskData);
    });

    expect(service.isLoading()).toBe(true);

    const req = httpMock.expectOne(`${environment.apiUrl}/portfolio/risk`);
    expect(req.request.method).toBe('GET');
    req.flush(mockRiskData);

    expect(service.isLoading()).toBe(false);
    expect(service.riskData()).toEqual(mockRiskData);
    expect(service.error()).toBeNull();
  });

  it('should handle HTTP errors gracefully', () => {
    service.getPortfolioRisk().subscribe({
      error: (err) => {
        expect(err).toBeTruthy();
        expect(service.isLoading()).toBe(false);
        expect(service.riskData()).toBeNull();
        expect(service.error()).toBe('Unauthorized');
      }
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/portfolio/risk`);
    req.flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });
  });
});
