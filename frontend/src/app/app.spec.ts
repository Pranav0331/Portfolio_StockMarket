import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { App } from './app';
import { AuthService } from './services/auth.service';

describe('App', () => {
  let authService: AuthService;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    }).compileComponents();

    authService = TestBed.inject(AuthService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render brand title and hero headline', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.brand-title')?.textContent).toContain('Portfolio StockMarket');
    expect(compiled.querySelector('.hero-title')?.textContent).toContain('Smart Portfolio Management');
  });

  it('should render Google OAuth login button when not authenticated', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    const googleBtn = compiled.querySelector('#google-login-btn');
    expect(googleBtn).toBeTruthy();
    expect(googleBtn?.textContent).toContain('Continue with Google');
  });

  it('should toggle theme and persist to localStorage', async () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();

    expect(app.currentTheme()).toBe('dark');
    app.toggleTheme();
    expect(app.currentTheme()).toBe('light');
    expect(localStorage.getItem('portfolio_theme')).toBe('light');

    app.toggleTheme();
    expect(app.currentTheme()).toBe('dark');
    expect(localStorage.getItem('portfolio_theme')).toBe('dark');
  });

  it('should render all 6 feature cards and 3 how-it-works steps', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;

    const featureCards = compiled.querySelectorAll('.feature-card');
    expect(featureCards.length).toBe(6);

    const featureNames = Array.from(featureCards).map(c => c.querySelector('.feature-name')?.textContent);
    expect(featureNames).toContain('Portfolio Tracking');
    expect(featureNames).toContain('Market Monitoring');
    expect(featureNames).toContain('Watchlist');
    expect(featureNames).toContain('Trading & Orders');
    expect(featureNames).toContain('Transactions');
    expect(featureNames).toContain('Risk & Analysis');

    const stepCards = compiled.querySelectorAll('.step-card');
    expect(stepCards.length).toBe(3);
  });

  it('should render user profile when authenticated', async () => {
    authService.setSession({
      id: 1,
      email: 'oauthuser@example.com',
      name: 'Google User',
      role: 'ROLE_USER',
      token: 'jwt-token-xyz'
    });

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    const profile = compiled.querySelector('#auth-user-profile');
    expect(profile).toBeTruthy();
    expect(compiled.querySelector('.user-name')?.textContent).toContain('Google User');
    expect(compiled.querySelector('.user-email')?.textContent).toContain('oauthuser@example.com');
  });

  it('should invoke loginWithGoogle when button clicked', async () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    const authSpy = vi.spyOn(authService, 'loginWithGoogle').mockImplementation(() => {});

    fixture.detectChanges();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    const googleBtn = compiled.querySelector('#google-login-btn') as HTMLButtonElement;
    googleBtn?.click();

    expect(authSpy).toHaveBeenCalled();
  });
});
