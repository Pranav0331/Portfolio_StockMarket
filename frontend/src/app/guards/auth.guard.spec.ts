import { TestBed } from '@angular/core/testing';
import { Router, ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { authGuard, rootGuard, guestGuard } from './auth.guard';
import { AuthService } from '../services/auth.service';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('Route Guards', () => {
  let authService: AuthService;
  let router: Router;

  beforeEach(() => {
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
      authService.currentUser.set({
        id: 1,
        email: 'investor@example.com',
        name: 'Investor',
        token: 'valid-token'
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
      authService.currentUser.set({
        id: 1,
        email: 'user@example.com',
        name: 'User',
        token: 'valid-token'
      });
      const route = { queryParams: {} } as unknown as ActivatedRouteSnapshot;
      const state = { url: '/' } as RouterStateSnapshot;

      const result = TestBed.runInInjectionContext(() => rootGuard(route, state)) as UrlTree;
      expect(result).toBeTruthy();
      expect(router.createUrlTree).toHaveBeenCalledWith(['/dashboard']);
    });

    it('should handle OAuth callback query parameters and redirect to /dashboard', () => {
      const route = {
        queryParams: {
          token: 'google-oauth-token',
          email: 'googleuser@gmail.com',
          name: 'Google User',
          role: 'ROLE_USER'
        }
      } as unknown as ActivatedRouteSnapshot;
      const state = { url: '/?token=google-oauth-token&email=googleuser@gmail.com' } as RouterStateSnapshot;

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
      authService.currentUser.set({
        id: 1,
        email: 'user@example.com',
        name: 'User',
        token: 'valid-token'
      });
      const route = {} as ActivatedRouteSnapshot;
      const state = { url: '/login' } as RouterStateSnapshot;

      const result = TestBed.runInInjectionContext(() => guestGuard(route, state)) as UrlTree;
      expect(result).toBeTruthy();
      expect(router.createUrlTree).toHaveBeenCalledWith(['/dashboard']);
    });
  });
});
