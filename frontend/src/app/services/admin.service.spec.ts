import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { AdminService } from './admin.service';
import { AdminDashboardSummary, AdminUser, AdminOrder, AdminTransaction } from '../models/admin.model';
import { environment } from '../../environments/environment';

describe('AdminService', () => {
  let service: AdminService;
  let httpMock: HttpTestingController;
  const baseUrl = `${environment.apiUrl}/admin`;

  const mockUser: AdminUser = {
    id: 1,
    email: 'trader@example.com',
    fullName: 'Trader User',
    role: 'ROLE_USER',
    status: 'ACTIVE',
    provider: 'LOCAL',
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now() - 86400000,
    holdingsCount: 5,
    ordersCount: 12,
    transactionsCount: 10,
    alertsCount: 2,
    watchlistCount: 4,
    virtualBalance: 98000.0
  };

  const mockSummary: AdminDashboardSummary = {
    stats: {
      totalUsers: 25,
      activeUsers: 22,
      suspendedUsers: 2,
      inactiveUsers: 1,
      totalOrders: 150,
      totalTransactions: 140,
      totalHoldings: 60,
      totalAlerts: 30,
      totalWatchlistItems: 50,
      timestamp: Date.now()
    },
    recentUsers: [mockUser],
    recentOrders: [],
    recentTransactions: []
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AdminService,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });
    service = TestBed.inject(AdminService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should fetch dashboard summary and update signal', () => {
    service.getDashboardSummary().subscribe((res) => {
      expect(res.stats.totalUsers).toBe(25);
      expect(res.recentUsers.length).toBe(1);
    });

    const req = httpMock.expectOne(`${baseUrl}/summary`);
    expect(req.request.method).toBe('GET');
    req.flush(mockSummary);

    expect(service.summaryData()).toEqual(mockSummary);
    expect(service.isLoading()).toBe(false);
  });

  it('should fetch filtered users and update signal', () => {
    service.getUsers('trader', 'ROLE_USER', 'ACTIVE').subscribe((users) => {
      expect(users.length).toBe(1);
      expect(users[0].email).toBe('trader@example.com');
    });

    const req = httpMock.expectOne((r) => r.url.startsWith(`${baseUrl}/users`));
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('query')).toBe('trader');
    expect(req.request.params.get('role')).toBe('ROLE_USER');
    expect(req.request.params.get('status')).toBe('ACTIVE');
    req.flush([mockUser]);

    expect(service.usersList().length).toBe(1);
  });

  it('should update user status', () => {
    const updatedUser: AdminUser = {
      ...mockUser,
      status: 'SUSPENDED'
    };

    service.usersList.set([mockUser]);

    service.updateUserStatus(1, 'SUSPENDED').subscribe((res) => {
      expect(res.status).toBe('SUSPENDED');
    });

    const req = httpMock.expectOne(`${baseUrl}/users/1/status`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ status: 'SUSPENDED' });
    req.flush(updatedUser);

    expect(service.usersList()[0].status).toBe('SUSPENDED');
  });

  it('should update user role', () => {
    const updatedUser: AdminUser = {
      ...mockUser,
      role: 'ROLE_ADMIN'
    };

    service.usersList.set([mockUser]);

    service.updateUserRole(1, 'ROLE_ADMIN').subscribe((res) => {
      expect(res.role).toBe('ROLE_ADMIN');
    });

    const req = httpMock.expectOne(`${baseUrl}/users/1/role`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ role: 'ROLE_ADMIN' });
    req.flush(updatedUser);

    expect(service.usersList()[0].role).toBe('ROLE_ADMIN');
  });

  it('should fetch recent orders and transactions', () => {
    const mockOrder: AdminOrder = {
      id: 10,
      userId: 1,
      userEmail: 'trader@example.com',
      userName: 'Trader User',
      symbol: 'AAPL',
      companyName: 'Apple Inc.',
      orderType: 'BUY',
      quantity: 10,
      pricePerUnit: 180.0,
      totalAmount: 1800.0,
      status: 'FILLED',
      createdAt: Date.now()
    };

    service.getOrders(10).subscribe((orders) => {
      expect(orders.length).toBe(1);
    });

    const reqOrder = httpMock.expectOne(`${baseUrl}/orders?limit=10`);
    expect(reqOrder.request.method).toBe('GET');
    reqOrder.flush([mockOrder]);

    const mockTx: AdminTransaction = {
      id: 20,
      userId: 1,
      userEmail: 'trader@example.com',
      userName: 'Trader User',
      symbol: 'AAPL',
      companyName: 'Apple Inc.',
      transactionType: 'BUY',
      quantity: 10,
      pricePerUnit: 180.0,
      totalAmount: 1800.0,
      fees: 1.5,
      status: 'SUCCESS',
      createdAt: Date.now()
    };

    service.getTransactions(10).subscribe((txs) => {
      expect(txs.length).toBe(1);
    });

    const reqTx = httpMock.expectOne(`${baseUrl}/transactions?limit=10`);
    expect(reqTx.request.method).toBe('GET');
    reqTx.flush([mockTx]);
  });
});
