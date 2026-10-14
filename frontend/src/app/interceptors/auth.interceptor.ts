import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';

let isRedirectingToLogin = false;

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const isApiRequest = req.url.startsWith(environment.apiUrl) || req.url.startsWith('/api');

  // Market data, broker status, and auth endpoints must NEVER trigger application logout
  const isExcludedFromLogout =
    req.url.includes('/api/upstox/') ||
    req.url.includes('/api/market/') ||
    req.url.includes('/api/health') ||
    req.url.includes('/api/auth/login') ||
    req.url.includes('/api/auth/register') ||
    req.url.includes('/api/auth/logout');

  let authReq = req;
  const token = authService.getToken();

  // Attach Authorization header to our backend API requests if token is available
  if (token && isApiRequest && !req.headers.has('Authorization')) {
    authReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      // Only handle genuine 401 Unauthorized for authenticated user API calls
      if (
        error.status === 401 &&
        isApiRequest &&
        !isExcludedFromLogout &&
        (req.headers.has('Authorization') || token !== null)
      ) {
        if (!isRedirectingToLogin) {
          isRedirectingToLogin = true;
          authService.clearSession();

          const currentUrl = router.url;
          const returnUrl =
            currentUrl && !currentUrl.startsWith('/login') && !currentUrl.startsWith('/oauth2')
              ? currentUrl
              : '/dashboard';

          router.navigate(['/login'], { queryParams: { returnUrl } }).finally(() => {
            setTimeout(() => {
              isRedirectingToLogin = false;
            }, 600);
          });
        }
      }

      return throwError(() => error);
    })
  );
};

