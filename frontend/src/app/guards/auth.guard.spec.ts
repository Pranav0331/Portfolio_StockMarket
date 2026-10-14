import { TestBed } from '@angular/core/testing';
import { Router, ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { authGuard, rootGuard, guestGuard } from './auth.guard';
import { AuthService } from '../services/auth.service';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

function createMockJwt(expSecs = Math.floor(Date.now() / 1000) + 3600, role = 'ROLE_USER', email = 'investor@example.com'): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({
    sub: email,
    userId: 1,
    name: 'Investor',
    role,
    exp: expSecs
  }));
  return `${header}.${payload}.signature`;
}

describe('Route Guards', () => {
  let authService: AuthService;
  let router: Router;

  beforeEach(() => {
    TestBed.resetTestingModule();
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: Router,
          useValue: {
            createUrlTree: vi.fn().mockImplementation((path, extras) => ({ path, extras }))
          }
        }
      ]
    });

    authService = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('authGuard', () => {
    it('should allow navigation when user is authenticated', () => {
      const validToken = createMockJwt();
      authService.currentUser.set({
        id: 1,
        email: 'investor@example.com',
        name: 'Investor',
        token: validToken
      });

      const route = {} as ActivatedRouteSnapshot;
      const state = { url: '/dashboard' } as RouterStateSnapshot;

      const result = TestBed.runInInjectionContext(() => authGuard(route, state));
      expect(result).toBe(true);
    });

    it('should redirect to /login when user is not authenticated', () => {
      authService.currentUser.set(null);

      const route = {} as ActivatedRouteSnapshot;
      const state = { url: '/dashboard' } as RouterStateSnapshot;

      const result = TestBed.runInInjectionContext(() => authGuard(route, state)) as UrlTree;
      expect(result).toBeTruthy();
      expect(router.createUrlTree).toHaveBeenCalledWith(['/login'], { queryParams: { returnUrl: '/dashboard' } });
    });
  });

  describe('rootGuard', () => {
    it('should allow public access to home page when user is logged out', () => {
      authService.currentUser.set(null);
      const route = { queryParams: {} } as unknown as ActivatedRouteSnapshot;
      const state = { url: '/' } as RouterStateSnapshot;

      const result = TestBed.runInInjectionContext(() => rootGuard(route, state));
      expect(result).toBe(true);
    });

    it('should redirect authenticated user from root to /dashboard', () => {
      const validToken = createMockJwt();
      authService.currentUser.set({
        id: 1,
        email: 'user@example.com',
        name: 'User',
        token: validToken
      });
      const route = { queryParams: {} } as unknown as ActivatedRouteSnapshot;
      const state = { url: '/' } as RouterStateSnapshot;

      const result = TestBed.runInInjectionContext(() => rootGuard(route, state)) as UrlTree;
      expect(result).toBeTruthy();
      expect(router.createUrlTree).toHaveBeenCalledWith(['/dashboard']);
    });

    it('should handle OAuth callback query parameters and redirect to /dashboard', () => {
      const validToken = createMockJwt(Math.floor(Date.now() / 1000) + 3600, 'ROLE_USER', 'googleuser@gmail.com');
      const route = {
        queryParams: {
          token: validToken,
          email: 'googleuser@gmail.com',
          name: 'Google User',
          role: 'ROLE_USER'
        }
      } as unknown as ActivatedRouteSnapshot;
      const state = { url: `/?token=${validToken}&email=googleuser@gmail.com` } as RouterStateSnapshot;

      const result = TestBed.runInInjectionContext(() => rootGuard(route, state)) as UrlTree;
      expect(result).toBeTruthy();
      expect(router.createUrlTree).toHaveBeenCalledWith(['/dashboard']);
      expect(authService.currentUser()?.email).toBe('googleuser@gmail.com');
    });
  });

  describe('guestGuard', () => {
    it('should allow access to login/signup when user is not authenticated', () => {
      authService.currentUser.set(null);
      const route = {} as ActivatedRouteSnapshot;
      const state = { url: '/login' } as RouterStateSnapshot;

      const result = TestBed.runInInjectionContext(() => guestGuard(route, state));
      expect(result).toBe(true);
    });

    it('should redirect authenticated user from login to /dashboard', () => {
      const validToken = createMockJwt();
      authService.currentUser.set({
        id: 1,
        email: 'user@example.com',
        name: 'User',
        token: validToken
      });
      const route = {} as ActivatedRouteSnapshot;
      const state = { url: '/login' } as RouterStateSnapshot;

      const result = TestBed.runInInjectionContext(() => guestGuard(route, state)) as UrlTree;
      expect(result).toBeTruthy();
      expect(router.createUrlTree).toHaveBeenCalledWith(['/dashboard']);
    });
  });
});
