import { Component, inject, OnInit, signal, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs/operators';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly title = signal('Portfolio StockMarket');
  readonly errorMessage = signal<string | null>(null);
  readonly oauthMessage = signal<string | null>(null);

  readonly currentTheme = signal<'dark' | 'light'>('dark');
  readonly isMobileMenuOpen = signal<boolean>(false);
  readonly isDashboardRoute = signal<boolean>(false);

  constructor() {
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((event: NavigationEnd) => {
        const url = event.urlAfterRedirects || event.url;
        this.isDashboardRoute.set(url.startsWith('/dashboard'));
        this.closeMobileMenu();
      });
  }

  ngOnInit(): void {
    this.initTheme();
    this.checkInitialRoute();
  }

  private checkInitialRoute(): void {
    if (this.router.url && this.router.url.startsWith('/dashboard')) {
      this.isDashboardRoute.set(true);
    }
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

  navigateAndScroll(sectionId: string): void {
    this.closeMobileMenu();
    if (this.router.url === '/' || this.router.url.startsWith('/#') || this.router.url.startsWith('/?')) {
      if (typeof document !== 'undefined') {
        const element = document.getElementById(sectionId);
        if (element && typeof element.scrollIntoView === 'function') {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    } else {
      this.router.navigate(['/']).then(() => {
        setTimeout(() => {
          if (typeof document !== 'undefined') {
            const element = document.getElementById(sectionId);
            if (element && typeof element.scrollIntoView === 'function') {
              element.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }
        }, 150);
      });
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
}
