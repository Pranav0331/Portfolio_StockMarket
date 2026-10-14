import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';

function createMockJwt(expSecs = Math.floor(Date.now() / 1000) + 3600): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({
    sub: 'user@example.com',
    userId: 1,
    name: 'User',
    role: 'ROLE_USER',
    exp: expSecs
  }));
  return `${header}.${payload}.signature`;
}

describe('authInterceptor', () => {
  let httpClient: HttpClient;
  let httpTesting: HttpTestingController;
  let authService: AuthService;
  let router: Router;

  beforeEach(() => {
    TestBed.resetTestingModule();
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        {
          provide: Router,
          useValue: {
            url: '/dashboard/portfolio',
            navigate: vi.fn().mockReturnValue(Promise.resolve(true))
          }
        }
      ]
    });

    httpClient = TestBed.inject(HttpClient);
    httpTesting = TestBed.inject(HttpTestingController);
    authService = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    httpTesting.verify();
    localStorage.clear();
  });

  it('should attach Authorization Bearer header to API requests when token exists', () => {
    const validToken = createMockJwt();
    localStorage.setItem('token', validToken);
    authService.loadStoredUser();

    httpClient.get(`${environment.apiUrl}/portfolio`).subscribe();

    const req = httpTesting.expectOne(`${environment.apiUrl}/portfolio`);
    expect(req.request.headers.has('Authorization')).toBe(true);
    expect(req.request.headers.get('Authorization')).toBe(`Bearer ${validToken}`);
    req.flush({});
  });

  it('should NOT attach Authorization header to external third-party requests', () => {
    const validToken = createMockJwt();
    localStorage.setItem('token', validToken);
    authService.loadStoredUser();

    httpClient.get('https://api.external.com/data').subscribe();

    const req = httpTesting.expectOne('https://api.external.com/data');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('should NOT log out user when Upstox / market data endpoints return 401', () => {
    const validToken = createMockJwt();
    localStorage.setItem('token', validToken);
    localStorage.setItem('user', JSON.stringify({ email: 'user@example.com', token: validToken }));
    authService.loadStoredUser();

    let errorReceived: any;
    httpClient.get(`${environment.apiUrl}/upstox/quote?symbol=RELIANCE`).subscribe({
      error: (err) => { errorReceived = err; }
    });

    const req = httpTesting.expectOne(`${environment.apiUrl}/upstox/quote?symbol=RELIANCE`);
    req.flush(
      { message: 'Upstox token expired or invalid' },
      { status: 401, statusText: 'Unauthorized' }
    );

    expect(errorReceived).toBeTruthy();
    expect(errorReceived.status).toBe(401);
    // User session MUST remain intact!
    expect(authService.isAuthenticated()).toBe(true);
    expect(authService.currentUser()).not.toBeNull();
    expect(localStorage.getItem('token')).toBe(validToken);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('should log out user and redirect to /login when protected user endpoint returns 401', () => {
    const validToken = createMockJwt();
    localStorage.setItem('token', validToken);
    localStorage.setItem('user', JSON.stringify({ email: 'user@example.com', token: validToken }));
    authService.loadStoredUser();

    let errorReceived: any;
    httpClient.get(`${environment.apiUrl}/portfolio`).subscribe({
      error: (err) => { errorReceived = err; }
    });

    const req = httpTesting.expectOne(`${environment.apiUrl}/portfolio`);
    req.flush(
      { message: 'Token expired' },
      { status: 401, statusText: 'Unauthorized' }
    );

    expect(errorReceived).toBeTruthy();
    expect(errorReceived.status).toBe(401);
    // User session should be cleared for genuine user endpoint 401
    expect(authService.currentUser()).toBeNull();
    expect(localStorage.getItem('token')).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(['/login'], { queryParams: { returnUrl: '/dashboard/portfolio' } });
  });
});
