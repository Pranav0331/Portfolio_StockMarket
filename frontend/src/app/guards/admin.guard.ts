import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Protects admin dashboard routes - only users with ROLE_ADMIN or ADMIN role may enter.
 * Non-admin users are redirected to /dashboard.
 */
export const adminGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    return router.createUrlTree(['/login']);
  }

  const user = authService.currentUser();
  const role = user?.role?.toUpperCase();

  if (role === 'ROLE_ADMIN' || role === 'ADMIN') {
    return true;
  }

  // Non-admin users are redirected back to the user dashboard
  return router.createUrlTree(['/dashboard']);
};
