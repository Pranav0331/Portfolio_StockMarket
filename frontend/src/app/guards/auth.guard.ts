import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Protects dashboard routes - only authenticated users may enter.
 * Unauthenticated users are redirected to /login with returnUrl.
 */
export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

/**
 * Root route guard (for path: '').
 * - If URL contains OAuth callback params (token & email), processes them and goes to /dashboard.
 * - If user is already authenticated, redirects automatically to /dashboard.
 * - Otherwise, allows public access to the Home page.
 */
export const rootGuard: CanActivateFn = (route) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Check if OAuth callback query parameters are present on root URL
  const token = route.queryParams['token'];
  const email = route.queryParams['email'];
  if (token && email) {
    const success = authService.handleOAuthCallback({
      token,
      id: route.queryParams['id'],
      email,
      name: route.queryParams['name'],
      role: route.queryParams['role']
    });
    if (success) {
      return router.createUrlTree(['/dashboard']);
    }
  }

  if (authService.isAuthenticated()) {
    return router.createUrlTree(['/dashboard']);
  }

  return true;
};

/**
 * Guest-only routes guard (for /login and /signup).
 * If user is already authenticated, redirect to /dashboard.
 */
export const guestGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return router.createUrlTree(['/dashboard']);
  }

  return true;
};
