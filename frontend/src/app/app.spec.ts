import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { AuthService } from './services/auth.service';
import { routes } from './app.routes';

describe('App', () => {
  let authService: AuthService;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter(routes)
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

  it('should render brand title in navbar and footer', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.brand-title')?.textContent).toContain('Portfolio StockMarket');
  });

  it('should render Google OAuth login button and Login/Signup links when not authenticated', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    const googleBtn = compiled.querySelector('#google-login-btn');
    expect(googleBtn).toBeTruthy();
    expect(googleBtn?.textContent).toContain('Continue with Google');
    expect(compiled.querySelector('#nav-login-btn')).toBeTruthy();
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
