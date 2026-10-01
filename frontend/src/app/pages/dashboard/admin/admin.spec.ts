import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AdminComponent } from './admin';
import { AdminService } from '../../../services/admin.service';
import { AuthService } from '../../../services/auth.service';
import { AdminDashboardSummary, AdminUser, AdminOrder, AdminTransaction } from '../../../models/admin.model';

describe('AdminComponent', () => {
  let component: AdminComponent;
  let fixture: ComponentFixture<AdminComponent>;
  let adminService: AdminService;
  let authService: AuthService;

  const mockAdminUser: AdminUser = {
    id: 1,
    email: 'admin@example.com',
    fullName: 'System Admin',
    role: 'ROLE_ADMIN',
    status: 'ACTIVE',
    provider: 'LOCAL',
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now() - 86400000,
    holdingsCount: 3,
    ordersCount: 15,
    transactionsCount: 12,
    alertsCount: 4,
    watchlistCount: 6,
    virtualBalance: 100000.0
  };

  const mockNormalUser: AdminUser = {
    id: 2,
    email: 'trader@example.com',
    fullName: 'Normal Trader',
    role: 'ROLE_USER',
    status: 'ACTIVE',
    provider: 'LOCAL',
    createdAt: Date.now() - 43200000,
    updatedAt: Date.now() - 43200000,
    holdingsCount: 2,
    ordersCount: 5,
    transactionsCount: 4,
    alertsCount: 1,
    watchlistCount: 3,
    virtualBalance: 95000.0
  };

  const mockSummary: AdminDashboardSummary = {
    stats: {
      totalUsers: 2,
      activeUsers: 2,
      suspendedUsers: 0,
      inactiveUsers: 0,
      totalOrders: 20,
      totalTransactions: 16,
      totalHoldings: 5,
      totalAlerts: 5,
      totalWatchlistItems: 9,
      timestamp: Date.now()
    },
    recentUsers: [mockAdminUser, mockNormalUser],
    recentOrders: [],
    recentTransactions: []
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminComponent],
      providers: [
        AdminService,
        AuthService,
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([])
      ]
    }).compileComponents();

    adminService = TestBed.inject(AdminService);
    authService = TestBed.inject(AuthService);

    // Mock auth user as admin
    authService.currentUser.set({
      id: 1,
      email: 'admin@example.com',
      name: 'System Admin',
      role: 'ROLE_ADMIN',
      token: 'jwt-token'
    });

    vi.spyOn(adminService, 'getDashboardSummary').mockImplementation(() => {
      adminService.summaryData.set(mockSummary);
      return of(mockSummary);
    });

    vi.spyOn(adminService, 'getUsers').mockImplementation(() => {
      adminService.usersList.set([mockAdminUser, mockNormalUser]);
      return of([mockAdminUser, mockNormalUser]);
    });

    fixture = TestBed.createComponent(AdminComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create AdminComponent and load summary & users on init', () => {
    expect(component).toBeTruthy();
    expect(adminService.getDashboardSummary).toHaveBeenCalled();
    expect(adminService.getUsers).toHaveBeenCalled();
    expect(component.summaryData()?.stats.totalUsers).toBe(2);
    expect(component.usersList().length).toBe(2);
  });

  it('should switch tabs and load tab data', () => {
    const mockOrders: AdminOrder[] = [
      {
        id: 1,
        userId: 2,
        userEmail: 'trader@example.com',
        userName: 'Normal Trader',
        symbol: 'AAPL',
        companyName: 'Apple Inc.',
        orderType: 'BUY',
        quantity: 10,
        pricePerUnit: 180.0,
        totalAmount: 1800.0,
        status: 'FILLED',
        createdAt: Date.now()
      }
    ];

    vi.spyOn(adminService, 'getOrders').mockImplementation(() => {
      adminService.ordersList.set(mockOrders);
      return of(mockOrders);
    });

    component.setTab('ORDERS');
    expect(component.activeTab()).toBe('ORDERS');
    expect(adminService.getOrders).toHaveBeenCalled();
    expect(component.filteredOrders().length).toBe(1);
  });

  it('should filter users by search keyword and role', () => {
    component.searchQuery.set('trader');
    expect(component.filteredUsers().length).toBe(1);
    expect(component.filteredUsers()[0].email).toBe('trader@example.com');

    component.searchQuery.set('');
    component.selectedRole.set('ROLE_ADMIN');
    expect(component.filteredUsers().length).toBe(1);
    expect(component.filteredUsers()[0].role).toBe('ROLE_ADMIN');
  });

  it('should open status modal and update user status', () => {
    const updatedUser: AdminUser = {
      ...mockNormalUser,
      status: 'SUSPENDED'
    };
    vi.spyOn(adminService, 'updateUserStatus').mockReturnValue(of(updatedUser));

    component.openStatusModal(mockNormalUser);
    expect(component.statusModalUser()).toEqual(mockNormalUser);

    component.targetStatus.set('SUSPENDED');
    component.submitStatusUpdate();

    expect(adminService.updateUserStatus).toHaveBeenCalledWith(2, 'SUSPENDED');
    expect(component.statusModalUser()).toBeNull();
  });

  it('should open role modal and update user role', () => {
    const updatedUser: AdminUser = {
      ...mockNormalUser,
      role: 'ROLE_ADMIN'
    };
    vi.spyOn(adminService, 'updateUserRole').mockReturnValue(of(updatedUser));

    component.openRoleModal(mockNormalUser);
    expect(component.roleModalUser()).toEqual(mockNormalUser);

    component.targetRole.set('ROLE_ADMIN');
    component.submitRoleUpdate();

    expect(adminService.updateUserRole).toHaveBeenCalledWith(2, 'ROLE_ADMIN');
    expect(component.roleModalUser()).toBeNull();
  });

  it('should identify current logged-in admin user', () => {
    expect(component.isCurrentAdmin(mockAdminUser)).toBe(true);
    expect(component.isCurrentAdmin(mockNormalUser)).toBe(false);
  });
});
