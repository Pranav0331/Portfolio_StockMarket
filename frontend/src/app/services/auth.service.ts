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

  decodeTokenPayload(token?: string | null): any {
    if (!token) return null;
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const pad = base64.length % 4;
      if (pad) {
        base64 += '='.repeat(4 - pad);
      }
      const decoded = atob(base64);
      try {
        const bytes = Uint8Array.from(decoded, (c) => c.charCodeAt(0));
        return JSON.parse(new TextDecoder().decode(bytes));
      } catch {
        return JSON.parse(decoded);
      }
    } catch {
      return null;
    }
  }

  isTokenExpired(token?: string | null): boolean {
    if (!token) return true;
    const payload = this.decodeTokenPayload(token);
    if (!payload) return true;
    if (typeof payload.exp !== 'number') return false;
    return payload.exp * 1000 <= Date.now();
  }

  getToken(): string | null {
    const current = this.currentUser();
    if (current?.token && !this.isTokenExpired(current.token)) {
      return current.token;
    }
    if (typeof localStorage !== 'undefined') {
      const token = localStorage.getItem('token');
      if (token && !this.isTokenExpired(token)) {
        return token;
      }
    }
    return null;
  }

  loadStoredUser(): void {
    if (typeof localStorage === 'undefined') return;
    const token = localStorage.getItem('token');
    if (!token) {
      this.currentUser.set(null);
      return;
    }

    if (this.isTokenExpired(token)) {
      this.clearSession();
      return;
    }

    const userStr = localStorage.getItem('user');
    let user: AuthUser | null = null;
    if (userStr) {
      try {
        user = JSON.parse(userStr);
      } catch {
        // Corrupted user string, reconstruct from valid token claims
      }
    }

    if (!user) {
      const payload = this.decodeTokenPayload(token);
      if (payload) {
        user = {
          id: payload.userId || payload.id ? Number(payload.userId || payload.id) : undefined,
          email: payload.sub || payload.email || '',
          name: payload.name || payload.sub || 'User',
          role: payload.role || 'ROLE_USER',
          token
        };
        try {
          localStorage.setItem('user', JSON.stringify(user));
        } catch {}
      }
    }

    if (user) {
      this.currentUser.set({ ...user, token });
    } else {
      this.clearSession();
    }
  }

  isAuthenticated(): boolean {
    const current = this.currentUser();
    if (current && current.token && !this.isTokenExpired(current.token)) {
      return true;
    }
    if (typeof localStorage !== 'undefined') {
      const token = localStorage.getItem('token');
      if (token && !this.isTokenExpired(token)) {
        this.loadStoredUser();
        const reloaded = this.currentUser();
        return reloaded !== null && !this.isTokenExpired(reloaded.token);
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
