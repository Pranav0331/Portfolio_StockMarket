import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AlertsComponent } from './alerts';
import { AlertService } from '../../../services/alert.service';
import { MarketService } from '../../../services/market.service';
import { AlertsResponse, AlertItem } from '../../../models/alert.model';
import { StockQuote } from '../../../models/market.model';

describe('AlertsComponent', () => {
  let component: AlertsComponent;
  let fixture: ComponentFixture<AlertsComponent>;
  let alertService: AlertService;
  let marketService: MarketService;

  const mockActiveAlert: AlertItem = {
    id: 1,
    stockId: 10,
    symbol: 'RELIANCE',
    companyName: 'Reliance Industries Ltd',
    exchange: 'NSE',
    currency: 'INR',
    targetPrice: 3050.0,
    conditionType: 'ABOVE',
    status: 'ACTIVE',
    currentPrice: 2980.0,
    priceAvailable: true,
    triggeredPrice: null,
    triggeredAt: null,
    createdAt: Date.now() - 3600000,
    updatedAt: Date.now() - 3600000,
    provider: 'Upstox',
    notes: 'Resistance breakout'
  };

  const mockTriggeredAlert: AlertItem = {
    id: 2,
    stockId: 20,
    symbol: 'AAPL',
    companyName: 'Apple Inc.',
    exchange: 'NASDAQ',
    currency: 'USD',
    targetPrice: 190.0,
    conditionType: 'ABOVE',
    status: 'TRIGGERED',
    currentPrice: 195.0,
    priceAvailable: true,
    triggeredPrice: 195.0,
    triggeredAt: Date.now() - 1800000,
    createdAt: Date.now() - 7200000,
    updatedAt: Date.now() - 1800000,
    provider: 'Twelve Data',
    notes: 'Earnings target'
  };

  const mockUnavailableAlert: AlertItem = {
    id: 3,
    stockId: 30,
    symbol: 'UNKNOWN',
    companyName: 'Unknown Stock',
    exchange: 'NASDAQ',
    currency: 'USD',
    targetPrice: 50.0,
    conditionType: 'BELOW',
    status: 'ACTIVE',
    currentPrice: null,
    priceAvailable: false,
    triggeredPrice: null,
    triggeredAt: null,
    createdAt: Date.now() - 3600000,
    updatedAt: Date.now() - 3600000,
    provider: 'Twelve Data',
    message: 'Market data unavailable'
  };

  const mockResponse: AlertsResponse = {
    alerts: [mockActiveAlert, mockTriggeredAlert, mockUnavailableAlert],
    totalCount: 3,
    activeCount: 2,
    triggeredCount: 1,
    disabledCount: 0,
    lastEvaluatedAt: Date.now()
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AlertsComponent],
      providers: [
        AlertService,
        MarketService,
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([])
      ]
    }).compileComponents();

    alertService = TestBed.inject(AlertService);
    marketService = TestBed.inject(MarketService);

    // Mock initial getAlerts implementation
    vi.spyOn(alertService, 'getAlerts').mockImplementation(() => {
      alertService.alertsData.set(mockResponse);
      return of(mockResponse);
    });

    fixture = TestBed.createComponent(AlertsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create AlertsComponent and load alerts on init', () => {
    expect(component).toBeTruthy();
    expect(alertService.getAlerts).toHaveBeenCalled();
    expect(component.totalCount()).toBe(3);
    expect(component.activeCount()).toBe(2);
    expect(component.triggeredCount()).toBe(1);
  });

  it('should filter alerts by status', () => {
    // Default ALL
    expect(component.filteredAlerts().length).toBe(3);

    // Filter ACTIVE
    component.statusFilter.set('ACTIVE');
    expect(component.filteredAlerts().length).toBe(2);

    // Filter TRIGGERED
    component.statusFilter.set('TRIGGERED');
    expect(component.filteredAlerts().length).toBe(1);
    expect(component.filteredAlerts()[0].symbol).toBe('AAPL');

    // Filter DISABLED
    component.statusFilter.set('DISABLED');
    expect(component.filteredAlerts().length).toBe(0);
  });

  it('should filter alerts by search text', () => {
    component.filterQuery.set('Reliance');
    expect(component.filteredAlerts().length).toBe(1);
    expect(component.filteredAlerts()[0].symbol).toBe('RELIANCE');

    component.filterQuery.set('Earnings');
    expect(component.filteredAlerts().length).toBe(1);
    expect(component.filteredAlerts()[0].symbol).toBe('AAPL');
  });

  it('should open create modal, validate input, and submit create alert', () => {
    const newAlertItem: AlertItem = {
      id: 4,
      stockId: 40,
      symbol: 'TSLA',
      companyName: 'Tesla Inc.',
      exchange: 'NASDAQ',
      currency: 'USD',
      targetPrice: 220.0,
      conditionType: 'BELOW',
      status: 'ACTIVE',
      currentPrice: 230.0,
      priceAvailable: true,
      triggeredPrice: null,
      triggeredAt: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      provider: 'Twelve Data'
    };

    vi.spyOn(alertService, 'createAlert').mockReturnValue(of(newAlertItem));

    component.openCreateModal();
    expect(component.isModalOpen()).toBe(true);
    expect(component.isEditing()).toBe(false);

    // Try save with empty fields
    component.saveAlert();
    expect(component.formError()).toContain('valid ticker symbol');

    // Fill valid data
    component.formSymbol.set('TSLA');
    component.formCondition.set('BELOW');
    component.formTargetPrice.set(220.0);
    component.formNotes.set('Dip buying');

    component.saveAlert();
    expect(alertService.createAlert).toHaveBeenCalledWith({
      symbol: 'TSLA',
      condition: 'BELOW',
      targetPrice: 220.0,
      notes: 'Dip buying'
    });
    expect(component.isModalOpen()).toBe(false);
  });

  it('should open edit modal and submit update alert', () => {
    const updatedItem: AlertItem = {
      ...mockActiveAlert,
      targetPrice: 3100.0,
      conditionType: 'ABOVE'
    };

    vi.spyOn(alertService, 'updateAlert').mockReturnValue(of(updatedItem));

    component.openEditModal(mockActiveAlert);
    expect(component.isModalOpen()).toBe(true);
    expect(component.isEditing()).toBe(true);
    expect(component.formSymbol()).toBe('RELIANCE');
    expect(component.formTargetPrice()).toBe(3050.0);

    component.formTargetPrice.set(3100.0);
    component.saveAlert();

    expect(alertService.updateAlert).toHaveBeenCalledWith(1, {
      condition: 'ABOVE',
      targetPrice: 3100.0,
      notes: 'Resistance breakout',
      status: 'ACTIVE'
    });
    expect(component.isModalOpen()).toBe(false);
  });

  it('should toggle alert active status', () => {
    const toggledItem: AlertItem = {
      ...mockActiveAlert,
      status: 'DISABLED'
    };
    vi.spyOn(alertService, 'toggleAlert').mockReturnValue(of(toggledItem));

    component.toggleAlert(mockActiveAlert);
    expect(alertService.toggleAlert).toHaveBeenCalledWith(1);
  });

  it('should prompt and execute alert deletion', () => {
    vi.spyOn(alertService, 'deleteAlert').mockReturnValue(of({ message: 'Deleted' }));

    component.promptDelete(1);
    expect(component.deleteConfirmId()).toBe(1);

    component.executeDelete(1);
    expect(alertService.deleteAlert).toHaveBeenCalledWith(1);
    expect(component.deleteConfirmId()).toBeNull();
  });

  it('should calculate distance percentage correctly', () => {
    const dist = component.getDistancePercent(110, 100);
    expect(dist).toBeCloseTo(10, 2);

    const distBelow = component.getDistancePercent(90, 100);
    expect(distBelow).toBeCloseTo(-10, 2);

    const distNull = component.getDistancePercent(null, 100);
    expect(distNull).toBeNull();
  });

  it('should fetch quote preview when symbol search is performed', () => {
    const mockQuote: StockQuote = {
      symbol: 'AAPL',
      name: 'Apple Inc.',
      price: 180.0,
      change: 2.5,
      changePercent: '+1.4%',
      previousClose: 177.5,
      open: 178.0,
      high: 181.0,
      low: 177.0,
      volume: 5000000,
      timestamp: Date.now()
    };


    vi.spyOn(marketService, 'getQuote').mockReturnValue(of(mockQuote));

    component.onSymbolSearch('AAPL');
    expect(marketService.getQuote).toHaveBeenCalledWith('AAPL');
    expect(component.previewPrice()).toBe(180.0);
  });
});
