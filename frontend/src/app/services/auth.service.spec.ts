import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AuthService, AuthUser } from './auth.service';

function createMockJwt(expSecs = Math.floor(Date.now() / 1000) + 3600, role = 'ROLE_USER', email = 'trader@example.com'): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({
    sub: email,
    userId: 1,
    name: 'Trader Joe',
    role,
    exp: expSecs
  }));
  return `${header}.${payload}.signature`;
}

describe('AuthService', () => {
  let service: AuthService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([])
      ]
    });
    service = TestBed.inject(AuthService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should initialize with null user when storage is empty', () => {
    expect(service.currentUser()).toBeNull();
  });

  it('should correctly identify expired vs valid JWT tokens', () => {
    const validToken = createMockJwt(Math.floor(Date.now() / 1000) + 3600);
    expect(service.isTokenExpired(validToken)).toBe(false);

    const expiredToken = createMockJwt(Math.floor(Date.now() / 1000) - 100);
    expect(service.isTokenExpired(expiredToken)).toBe(true);

    expect(service.isTokenExpired(null)).toBe(true);
    expect(service.isTokenExpired('')).toBe(true);
    expect(service.isTokenExpired('not-a-token')).toBe(true);
  });

  it('should handle valid OAuth callback params and set session', () => {
    const validToken = createMockJwt(Math.floor(Date.now() / 1000) + 3600, 'ROLE_USER', 'user@google.com');
    const success = service.handleOAuthCallback({
      token: validToken,
      id: '42',
      email: 'user@google.com',
      name: 'Google User',
      role: 'ROLE_USER'
    });

    expect(success).toBe(true);
    const user = service.currentUser();
    expect(user).toBeTruthy();
    expect(user?.email).toBe('user@google.com');
    expect(user?.name).toBe('Google User');
    expect(user?.id).toBe(42);
    expect(user?.token).toBe(validToken);
    expect(localStorage.getItem('token')).toBe(validToken);
    expect(service.isAuthenticated()).toBe(true);
  });

  it('should fail OAuth callback if error param is present', () => {
    const success = service.handleOAuthCallback({
      error: 'access_denied'
    });

    expect(success).toBe(false);
    expect(service.currentUser()).toBeNull();
  });

  it('should restore session from localStorage across page reload when valid', () => {
    const validToken = createMockJwt(Math.floor(Date.now() / 1000) + 7200, 'ROLE_ADMIN', 'admin@example.com');
    const storedUser: AuthUser = {
      id: 99,
      name: 'Admin Reload',
      email: 'admin@example.com',
      role: 'ROLE_ADMIN',
      token: validToken
    };

    localStorage.setItem('token', validToken);
    localStorage.setItem('user', JSON.stringify(storedUser));

    service.loadStoredUser();

    expect(service.isAuthenticated()).toBe(true);
    expect(service.currentUser()?.email).toBe('admin@example.com');
    expect(service.currentUser()?.role).toBe('ROLE_ADMIN');
    expect(service.getToken()).toBe(validToken);
  });

  it('should reconstruct user from valid JWT claims if user string in localStorage is missing or corrupted', () => {
    const validToken = createMockJwt(Math.floor(Date.now() / 1000) + 7200, 'ROLE_USER', 'claims@example.com');
    localStorage.setItem('token', validToken);
    localStorage.setItem('user', 'invalid-json{{{');

    service.loadStoredUser();

    expect(service.isAuthenticated()).toBe(true);
    expect(service.currentUser()?.email).toBe('claims@example.com');
    expect(service.currentUser()?.role).toBe('ROLE_USER');
  });

  it('should clear session if stored token in localStorage is genuinely expired', () => {
    const expiredToken = createMockJwt(Math.floor(Date.now() / 1000) - 300);
    localStorage.setItem('token', expiredToken);
    localStorage.setItem('user', JSON.stringify({ email: 'exp@example.com', token: expiredToken }));

    service.loadStoredUser();

    expect(service.isAuthenticated()).toBe(false);
    expect(service.currentUser()).toBeNull();
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
  });

  it('should login via api and set session upon success', () => {
    const validToken = createMockJwt();
    service.login({ email: 'trader@example.com', password: 'password123' }).subscribe((res) => {
      expect(res.token).toBe(validToken);
      expect(service.currentUser()?.email).toBe('trader@example.com');
      expect(localStorage.getItem('token')).toBe(validToken);
      expect(service.isAuthenticated()).toBe(true);
    });

    const req = httpTesting.expectOne('http://localhost:8080/api/auth/login');
    expect(req.request.method).toBe('POST');
    req.flush({
      token: validToken,
      id: 5,
      name: 'Trader Joe',
      email: 'trader@example.com',
      role: 'ROLE_USER',
      message: 'Authentication successful'
    });
  });

  it('should register via api', () => {
    service.register({
      name: 'New User',
      email: 'new@example.com',
      password: 'password123',
      confirmPassword: 'password123'
    }).subscribe((res) => {
      expect(res.id).toBe(12);
      expect(res.name).toBe('New User');
    });

    const req = httpTesting.expectOne('http://localhost:8080/api/auth/register');
    expect(req.request.method).toBe('POST');
    req.flush({
      id: 12,
      name: 'New User',
      email: 'new@example.com',
      role: 'ROLE_USER',
      message: 'User registered successfully'
    });
  });

  it('should clear session on logout', () => {
    const validToken = createMockJwt();
    const user: AuthUser = {
      email: 'user@google.com',
      token: validToken
    };
    service.setSession(user);
    expect(service.currentUser()).toBeTruthy();

    service.logout();
    const req = httpTesting.expectOne('http://localhost:8080/api/auth/logout');
    expect(req.request.method).toBe('POST');
    req.flush({});

    expect(service.currentUser()).toBeNull();
    expect(localStorage.getItem('token')).toBeNull();
    expect(service.isAuthenticated()).toBe(false);
  });
});
