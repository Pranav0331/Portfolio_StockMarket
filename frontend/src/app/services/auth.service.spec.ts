import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AuthService, AuthUser } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
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

  it('should handle valid OAuth callback params and set session', () => {
    const success = service.handleOAuthCallback({
      token: 'jwt.sample.token',
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
    expect(user?.token).toBe('jwt.sample.token');
    expect(localStorage.getItem('token')).toBe('jwt.sample.token');
  });

  it('should fail OAuth callback if error param is present', () => {
    const success = service.handleOAuthCallback({
      error: 'access_denied'
    });

    expect(success).toBe(false);
    expect(service.currentUser()).toBeNull();
  });

  it('should login via api and set session upon success', () => {
    service.login({ email: 'trader@example.com', password: 'password123' }).subscribe((res) => {
      expect(res.token).toBe('mock-jwt-token');
      expect(service.currentUser()?.email).toBe('trader@example.com');
      expect(localStorage.getItem('token')).toBe('mock-jwt-token');
    });

    const req = httpTesting.expectOne('http://localhost:8080/api/auth/login');
    expect(req.request.method).toBe('POST');
    req.flush({
      token: 'mock-jwt-token',
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
    const user: AuthUser = {
      email: 'user@google.com',
      token: 'token123'
    };
    service.setSession(user);
    expect(service.currentUser()).toBeTruthy();

    service.logout();
    const req = httpTesting.expectOne('http://localhost:8080/api/auth/logout');
    expect(req.request.method).toBe('POST');
    req.flush({});

    expect(service.currentUser()).toBeNull();
    expect(localStorage.getItem('token')).toBeNull();
  });
});
