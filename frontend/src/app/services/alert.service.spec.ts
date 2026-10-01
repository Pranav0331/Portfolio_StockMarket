import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { AlertService } from './alert.service';
import { AlertsResponse, AlertItem, CreateAlertRequest, UpdateAlertRequest } from '../models/alert.model';
import { environment } from '../../environments/environment';

describe('AlertService', () => {
  let service: AlertService;
  let httpMock: HttpTestingController;
  const baseUrl = `${environment.apiUrl}/alerts`;

  const mockAlert: AlertItem = {
    id: 1,
    stockId: 10,
    symbol: 'AAPL',
    companyName: 'Apple Inc.',
    exchange: 'NASDAQ',
    currency: 'USD',
    targetPrice: 200.0,
    conditionType: 'ABOVE',
    status: 'ACTIVE',
    currentPrice: 195.5,
    priceAvailable: true,
    triggeredPrice: null,
    triggeredAt: null,
    createdAt: Date.now() - 3600000,
    updatedAt: Date.now() - 3600000,
    provider: 'Twelve Data',
    notes: 'Breakout target'
  };

  const mockResponse: AlertsResponse = {
    alerts: [mockAlert],
    totalCount: 1,
    activeCount: 1,
    triggeredCount: 0,
    disabledCount: 0,
    lastEvaluatedAt: Date.now()
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AlertService,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });
    service = TestBed.inject(AlertService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should fetch user alerts and update signal state', () => {
    service.getAlerts().subscribe((res) => {
      expect(res.totalCount).toBe(1);
      expect(res.alerts[0].symbol).toBe('AAPL');
    });

    const req = httpMock.expectOne(baseUrl);
    expect(req.request.method).toBe('GET');
    req.flush(mockResponse);

    expect(service.alertsData()).toEqual(mockResponse);
    expect(service.isLoading()).toBe(false);
  });

  it('should create an alert and update reactive state', () => {
    const createReq: CreateAlertRequest = {
      symbol: 'TSLA',
      condition: 'BELOW',
      targetPrice: 210.0,
      notes: 'Dip buy'
    };

    const createdItem: AlertItem = {
      id: 2,
      stockId: 20,
      symbol: 'TSLA',
      companyName: 'Tesla Inc.',
      exchange: 'NASDAQ',
      currency: 'USD',
      targetPrice: 210.0,
      conditionType: 'BELOW',
      status: 'ACTIVE',
      currentPrice: 215.0,
      priceAvailable: true,
      triggeredPrice: null,
      triggeredAt: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      provider: 'Twelve Data',
      notes: 'Dip buy'
    };

    service.alertsData.set(mockResponse);

    service.createAlert(createReq).subscribe((item) => {
      expect(item.id).toBe(2);
      expect(item.symbol).toBe('TSLA');
    });

    const req = httpMock.expectOne(baseUrl);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(createReq);
    req.flush(createdItem);

    const updated = service.alertsData();
    expect(updated?.alerts.length).toBe(2);
    expect(updated?.activeCount).toBe(2);
  });

  it('should update an alert and refresh signal list', () => {
    const updateReq: UpdateAlertRequest = {
      targetPrice: 205.0,
      condition: 'ABOVE'
    };

    const updatedItem: AlertItem = {
      ...mockAlert,
      targetPrice: 205.0
    };

    service.alertsData.set(mockResponse);

    service.updateAlert(1, updateReq).subscribe((item) => {
      expect(item.targetPrice).toBe(205.0);
    });

    const req = httpMock.expectOne(`${baseUrl}/1`);
    expect(req.request.method).toBe('PUT');
    req.flush(updatedItem);

    expect(service.alertsData()?.alerts[0].targetPrice).toBe(205.0);
  });

  it('should toggle alert status and update signals', () => {
    const toggledItem: AlertItem = {
      ...mockAlert,
      status: 'DISABLED'
    };

    service.alertsData.set(mockResponse);

    service.toggleAlert(1).subscribe((item) => {
      expect(item.status).toBe('DISABLED');
    });

    const req = httpMock.expectOne(`${baseUrl}/1/toggle`);
    expect(req.request.method).toBe('PATCH');
    req.flush(toggledItem);

    const current = service.alertsData();
    expect(current?.disabledCount).toBe(1);
    expect(current?.activeCount).toBe(0);
  });

  it('should delete alert and remove from signals', () => {
    service.alertsData.set(mockResponse);

    service.deleteAlert(1).subscribe((res) => {
      expect(res.message).toBe('Alert deleted');
    });

    const req = httpMock.expectOne(`${baseUrl}/1`);
    expect(req.request.method).toBe('DELETE');
    req.flush({ message: 'Alert deleted' });

    expect(service.alertsData()?.alerts.length).toBe(0);
    expect(service.alertsData()?.totalCount).toBe(0);
  });

  it('should force evaluate alerts', () => {
    service.evaluateAlerts().subscribe((res) => {
      expect(res.totalCount).toBe(1);
    });

    const req = httpMock.expectOne(`${baseUrl}/evaluate`);
    expect(req.request.method).toBe('POST');
    req.flush(mockResponse);

    expect(service.alertsData()).toEqual(mockResponse);
  });
});
