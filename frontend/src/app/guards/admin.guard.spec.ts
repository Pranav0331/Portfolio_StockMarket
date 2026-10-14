import { TestBed } from '@angular/core/testing';
import { Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { adminGuard } from './admin.guard';
import { AuthService } from '../services/auth.service';
import { describe, it, expect, beforeEach, vi } from 'vitest';

function createMockJwt(expSecs = Math.floor(Date.now() / 1000) + 3600, role = 'ROLE_USER', email = 'user@example.com'): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({
    sub: email,
    userId: 1,
    name: 'User',
    role,
    exp: expSecs
  }));
  return `${header}.${payload}.signature`;
}

describe('adminGuard', () => {
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
            createUrlTree: vi.fn().mockImplementation((path) => ({ path }))
          }
        }
      ]
    });

    authService = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
  });

  it('should redirect unauthenticated users to /login', () => {
    authService.currentUser.set(null);

    const result = TestBed.runInInjectionContext(() =>
      adminGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)
    );

    expect(result).toEqual({ path: ['/login'] });
    expect(router.createUrlTree).toHaveBeenCalledWith(['/login']);
  });

  it('should redirect non-admin users to /dashboard', () => {
    const validToken = createMockJwt(Math.floor(Date.now() / 1000) + 3600, 'ROLE_USER', 'user@example.com');
    authService.currentUser.set({
      id: 1,
      name: 'Standard User',
      email: 'user@example.com',
      token: validToken,
      role: 'ROLE_USER'
    });

    const result = TestBed.runInInjectionContext(() =>
      adminGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)
    );

    expect(result).toEqual({ path: ['/dashboard'] });
    expect(router.createUrlTree).toHaveBeenCalledWith(['/dashboard']);
  });

  it('should allow users with ROLE_ADMIN role', () => {
    const validToken = createMockJwt(Math.floor(Date.now() / 1000) + 3600, 'ROLE_ADMIN', 'admin@example.com');
    authService.currentUser.set({
      id: 2,
      name: 'Admin User',
      email: 'admin@example.com',
      token: validToken,
      role: 'ROLE_ADMIN'
    });

    const result = TestBed.runInInjectionContext(() =>
      adminGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)
    );

    expect(result).toBe(true);
  });

  it('should allow users with ADMIN role', () => {
    const validToken = createMockJwt(Math.floor(Date.now() / 1000) + 3600, 'ADMIN', 'admin2@example.com');
    authService.currentUser.set({
      id: 3,
      name: 'Super Admin',
      email: 'admin2@example.com',
      token: validToken,
      role: 'ADMIN'
    });

    const result = TestBed.runInInjectionContext(() =>
      adminGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)
    );

    expect(result).toBe(true);
  });
});
