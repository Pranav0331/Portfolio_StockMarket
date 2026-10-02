import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthUser, LoginRequest, RegisterRequest, AuthResponse } from '../models/auth.model';

export type { AuthUser, LoginRequest, RegisterRequest, AuthResponse };

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly baseUrl = environment.apiUrl;
  private readonly backendUrl = environment.apiUrl.replace('/api', '');

  readonly currentUser = signal<AuthUser | null>(null);

  constructor() {
    this.loadStoredUser();
  }

  loadStoredUser(): void {
    if (typeof localStorage === 'undefined') return;
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        this.currentUser.set({ ...user, token });
      } catch {
        this.clearSession();
      }
    }
  }

  isAuthenticated(): boolean {
    if (this.currentUser()) {
      return true;
    }
    if (typeof localStorage !== 'undefined') {
      const token = localStorage.getItem('token');
      const userStr = localStorage.getItem('user');
      if (token && userStr) {
        try {
          const user = JSON.parse(userStr);
          this.currentUser.set({ ...user, token });
          return true;
        } catch {
          this.clearSession();
        }
      }
    }
    return false;
  }

  login(credentials: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/auth/login`, credentials).pipe(
      tap((res) => {
        if (res.token) {
          const user: AuthUser = {
            id: res.id,
            name: res.name,
            email: res.email,
            role: res.role || 'ROLE_USER',
            token: res.token
          };
          this.setSession(user);
        }
      })
    );
  }

  register(request: RegisterRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/auth/register`, request);
  }

  loginWithGoogle(): void {
    if (typeof window !== 'undefined') {
      window.location.href = `${this.backendUrl}/oauth2/authorization/google`;
    }
  }

  handleOAuthCallback(params: { token?: string; id?: string; email?: string; name?: string; role?: string; error?: string }): boolean {
    if (params.error) {
      return false;
    }
    if (params.token && params.email) {
      const user: AuthUser = {
        id: params.id ? Number(params.id) : undefined,
        email: params.email,
        name: params.name || params.email,
        role: params.role || 'ROLE_USER',
        token: params.token
      };
      this.setSession(user);
      return true;
    }
    return false;
  }

  setSession(user: AuthUser): void {
    if (typeof localStorage !== 'undefined') {
      if (user.token) {
        localStorage.setItem('token', user.token);
      }
      localStorage.setItem('user', JSON.stringify(user));
    }
    this.currentUser.set(user);
  }

  clearSession(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
    this.currentUser.set(null);
  }

  logout(): void {
    this.http.post(`${this.baseUrl}/auth/logout`, {}).subscribe({
      next: () => {
        this.clearSession();
        this.router.navigate(['/']);
      },
      error: () => {
        this.clearSession();
        this.router.navigate(['/']);
      }
    });
  }
}
