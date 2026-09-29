import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { HealthService } from './services/health.service';
import { AuthService } from './services/auth.service';
import { HealthStatus } from './models/health.model';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  private readonly healthService = inject(HealthService);
  readonly authService = inject(AuthService);

  readonly title = signal('Portfolio StockMarket');
  readonly healthStatus = signal<HealthStatus | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly oauthMessage = signal<string | null>(null);
  readonly isLoading = signal<boolean>(false);

  readonly currentTheme = signal<'dark' | 'light'>('dark');
  readonly isMobileMenuOpen = signal<boolean>(false);

  ngOnInit(): void {
    this.initTheme();
    this.checkOAuthCallback();
  }

  private initTheme(): void {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('portfolio_theme');
      if (stored === 'light' || stored === 'dark') {
        this.setTheme(stored);
      } else {
        const prefersLight = typeof window.matchMedia === 'function' && 
          window.matchMedia('(prefers-color-scheme: light)').matches;
        this.setTheme(prefersLight ? 'light' : 'dark');
      }
    }
  }

  toggleTheme(): void {
    const nextTheme = this.currentTheme() === 'dark' ? 'light' : 'dark';
    this.setTheme(nextTheme);
  }

  setTheme(theme: 'dark' | 'light'): void {
    this.currentTheme.set(theme);
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('portfolio_theme', theme);
      }
    }
  }

  toggleMobileMenu(): void {
    this.isMobileMenuOpen.update((open) => !open);
  }

  closeMobileMenu(): void {
    this.isMobileMenuOpen.set(false);
  }

  scrollToSection(id: string): void {
    this.closeMobileMenu();
    if (typeof document !== 'undefined') {
      const element = document.getElementById(id);
      if (element && typeof element.scrollIntoView === 'function') {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }

  private checkOAuthCallback(): void {
    if (typeof window !== 'undefined' && window.location.search) {
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get('token');
      const email = urlParams.get('email');
      const name = urlParams.get('name');
      const role = urlParams.get('role');
      const id = urlParams.get('id');
      const error = urlParams.get('error');

      if (error) {
        this.errorMessage.set(`Google Authentication Failed: ${error}`);
      } else if (token && email) {
        this.authService.handleOAuthCallback({
          token,
          id: id || undefined,
          email,
          name: name || undefined,
          role: role || undefined
        });
        this.oauthMessage.set(`Successfully authenticated as ${email} via Google OAuth 2.0`);
        // Clean URL query params
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }

  loginWithGoogle(): void {
    this.errorMessage.set(null);
    this.oauthMessage.set(null);
    this.authService.loginWithGoogle();
  }

  logout(): void {
    this.authService.logout();
    this.oauthMessage.set(null);
  }

  checkBackendHealth(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.healthService.getHealth().subscribe({
      next: (status) => {
        this.healthStatus.set(status);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.errorMessage.set(
          err.message || 'Unable to connect to Spring Boot backend at configured API URL.'
        );
        this.isLoading.set(false);
      }
    });
  }
}
