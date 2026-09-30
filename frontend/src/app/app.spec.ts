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

  it('should render Login and Signup links in public navbar and not Continue with Google in navbar', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('#nav-login-btn')).toBeTruthy();
    expect(compiled.querySelector('#nav-signup-btn')).toBeTruthy();
    expect(compiled.querySelector('#google-login-btn')).toBeNull();
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

  it('should switch to authenticated shell without public navbar when isDashboardRoute is true', async () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();

    app.isDashboardRoute.set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    // When on dashboard route, public navbar and footer are not rendered
    expect(compiled.querySelector('#navbar')).toBeNull();
    expect(compiled.querySelector('#footer')).toBeNull();
    // Only router-outlet is present
    expect(compiled.querySelector('router-outlet')).toBeTruthy();
  });

  it('should delegate loginWithGoogle method to authService', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    const authSpy = vi.spyOn(authService, 'loginWithGoogle').mockImplementation(() => {});

    app.loginWithGoogle();
    expect(authSpy).toHaveBeenCalled();
  });
});
