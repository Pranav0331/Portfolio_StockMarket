import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { DashboardLayoutComponent } from './dashboard-layout';
import { AuthService } from '../../services/auth.service';

describe('DashboardLayoutComponent', () => {
  let authService: AuthService;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [DashboardLayoutComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([])
      ]
    }).compileComponents();

    authService = TestBed.inject(AuthService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should create the dashboard layout component', () => {
    const fixture = TestBed.createComponent(DashboardLayoutComponent);
    const comp = fixture.componentInstance;
    expect(comp).toBeTruthy();
  });

  it('should render search bar, sidebar nav items, and user profile', async () => {
    authService.setSession({
      id: 1,
      name: 'Warren Buffet',
      email: 'warren@berkshire.com',
      role: 'ROLE_USER'
    });

    const fixture = TestBed.createComponent(DashboardLayoutComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.search-input')).toBeTruthy();
    expect(compiled.querySelector('.sidebar-nav')).toBeTruthy();
    expect(compiled.querySelector('#dashboard-user-btn')?.textContent).toContain('Warren Buffet');
  });

  it('should toggle sidebar collapsed state', () => {
    const fixture = TestBed.createComponent(DashboardLayoutComponent);
    const comp = fixture.componentInstance;

    expect(comp.isSidebarCollapsed()).toBe(false);
    comp.toggleSidebar();
    expect(comp.isSidebarCollapsed()).toBe(true);
    comp.toggleSidebar();
    expect(comp.isSidebarCollapsed()).toBe(false);
  });

  it('should toggle theme in dashboard layout', () => {
    const fixture = TestBed.createComponent(DashboardLayoutComponent);
    const comp = fixture.componentInstance;

    expect(comp.currentTheme()).toBe('dark');
    comp.toggleTheme();
    expect(comp.currentTheme()).toBe('light');
    expect(localStorage.getItem('portfolio_theme')).toBe('light');
  });
});
