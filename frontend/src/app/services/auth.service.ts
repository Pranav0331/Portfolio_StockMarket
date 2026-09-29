import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AuthUser {
  id?: number;
  name?: string;
  email?: string;
  role?: string;
  token?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly baseUrl = environment.apiUrl;
  private readonly backendUrl = 'http://localhost:8080';

  readonly currentUser = signal<AuthUser | null>(null);

  constructor(private readonly http: HttpClient) {
    this.loadStoredUser();
  }

  private loadStoredUser(): void {
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

  loginWithGoogle(): void {
    window.location.href = `${this.backendUrl}/oauth2/authorization/google`;
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
    if (user.token) {
      localStorage.setItem('token', user.token);
    }
    localStorage.setItem('user', JSON.stringify(user));
    this.currentUser.set(user);
  }

  clearSession(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    this.currentUser.set(null);
  }

  logout(): void {
    this.http.post(`${this.baseUrl}/auth/logout`, {}).subscribe({
      next: () => this.clearSession(),
      error: () => this.clearSession()
    });
  }
}
