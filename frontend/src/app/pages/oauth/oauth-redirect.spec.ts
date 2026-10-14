import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OAuthRedirectComponent } from './oauth-redirect';
import { AuthService } from '../../services/auth.service';

function createMockJwt(expSecs = Math.floor(Date.now() / 1000) + 3600): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({
    sub: 'google@example.com',
    userId: 88,
    name: 'Google User',
    role: 'ROLE_USER',
    exp: expSecs
  }));
  return `${header}.${payload}.signature`;
}

describe('OAuthRedirectComponent', () => {
  let router: Router;
  let authService: AuthService;

  beforeEach(() => {
    TestBed.resetTestingModule();
    localStorage.clear();
  });

  it('should process valid OAuth query params, save session and navigate to dashboard', () => {
    const validToken = createMockJwt();
    const routerMock = {
      navigate: vi.fn().mockReturnValue(Promise.resolve(true))
    };

    const activatedRouteMock = {
      snapshot: {
        queryParamMap: {
          get: (key: string) => {
            const map: Record<string, string> = {
              token: validToken,
              email: 'google@example.com',
              name: 'Google User',
              role: 'ROLE_USER',
              id: '88'
            };
            return map[key] || null;
          }
        }
      }
    };

    TestBed.configureTestingModule({
      imports: [OAuthRedirectComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Router, useValue: routerMock },
        { provide: ActivatedRoute, useValue: activatedRouteMock }
      ]
    });

    router = TestBed.inject(Router);
    authService = TestBed.inject(AuthService);

    const fixture = TestBed.createComponent(OAuthRedirectComponent);
    fixture.detectChanges();

    expect(authService.isAuthenticated()).toBe(true);
    expect(authService.currentUser()?.email).toBe('google@example.com');
    expect(localStorage.getItem('token')).toBe(validToken);
    expect(router.navigate).toHaveBeenCalledWith(['/dashboard'], { replaceUrl: true });
  });

  it('should navigate to login when error query param is present', () => {
    const routerMock = {
      navigate: vi.fn().mockReturnValue(Promise.resolve(true))
    };

    const activatedRouteMock = {
      snapshot: {
        queryParamMap: {
          get: (key: string) => {
            if (key === 'error') return 'access_denied';
            return null;
          }
        }
      }
    };

    TestBed.configureTestingModule({
      imports: [OAuthRedirectComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Router, useValue: routerMock },
        { provide: ActivatedRoute, useValue: activatedRouteMock }
      ]
    });

    router = TestBed.inject(Router);
    authService = TestBed.inject(AuthService);

    const fixture = TestBed.createComponent(OAuthRedirectComponent);
    fixture.detectChanges();

    expect(authService.isAuthenticated()).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { error: 'Authentication failed: access_denied' },
      replaceUrl: true
    });
  });
});
