import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { DashboardHomeComponent } from './dashboard-home';
import { AuthService } from '../../../services/auth.service';

describe('DashboardHomeComponent', () => {
  let authService: AuthService;

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
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should create the dashboard home component', () => {
    const fixture = TestBed.createComponent(DashboardHomeComponent);
    const comp = fixture.componentInstance;
    expect(comp).toBeTruthy();
  });

  it('should render welcome heading, 4 metric cards, and empty state cards', async () => {
    authService.setSession({
      id: 2,
      name: 'Charlie Munger',
      email: 'charlie@berkshire.com'
    });

    const fixture = TestBed.createComponent(DashboardHomeComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.welcome-heading')?.textContent).toContain('Charlie Munger');
    const metricCards = compiled.querySelectorAll('.metric-card');
    expect(metricCards.length).toBe(4);

    expect(compiled.querySelector('.holdings-card')).toBeTruthy();
    expect(compiled.querySelector('.market-card')).toBeTruthy();
    expect(compiled.querySelector('.watchlist-card')).toBeTruthy();
    expect(compiled.querySelector('.transactions-card')).toBeTruthy();
  });

  it('should switch market tabs', () => {
    const fixture = TestBed.createComponent(DashboardHomeComponent);
    const comp = fixture.componentInstance;

    expect(comp.activeTab()).toBe('indices');
    comp.setActiveTab('gainers');
    expect(comp.activeTab()).toBe('gainers');
    comp.setActiveTab('losers');
    expect(comp.activeTab()).toBe('losers');
  });
});
