import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.currentUser()) {
    return true;
  }

  if (typeof localStorage !== 'undefined') {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        authService.currentUser.set({ ...user, token });
        return true;
      } catch {
        authService.clearSession();
      }
    }
  }

  return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};
