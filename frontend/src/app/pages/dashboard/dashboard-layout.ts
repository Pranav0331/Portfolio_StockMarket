import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-dashboard-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, FormsModule],
  templateUrl: './dashboard-layout.html',
  styleUrl: './dashboard-layout.css'
})
export class DashboardLayoutComponent implements OnInit {
  readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly searchQuery = signal<string>('');
  readonly isSidebarCollapsed = signal<boolean>(false);
  readonly isMobileSidebarOpen = signal<boolean>(false);
  readonly isProfileMenuOpen = signal<boolean>(false);
  readonly isNotificationsOpen = signal<boolean>(false);
  readonly currentTheme = signal<'dark' | 'light'>('dark');

  ngOnInit(): void {
    this.initTheme();
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

  toggleSidebar(): void {
    this.isSidebarCollapsed.update((val) => !val);
  }

  toggleMobileSidebar(): void {
    this.isMobileSidebarOpen.update((val) => !val);
  }

  closeMobileSidebar(): void {
    this.isMobileSidebarOpen.set(false);
  }

  toggleProfileMenu(): void {
    this.isProfileMenuOpen.update((val) => !val);
    if (this.isProfileMenuOpen()) {
      this.isNotificationsOpen.set(false);
    }
  }

  toggleNotifications(): void {
    this.isNotificationsOpen.update((val) => !val);
    if (this.isNotificationsOpen()) {
      this.isProfileMenuOpen.set(false);
    }
  }

  closeDropdowns(): void {
    this.isProfileMenuOpen.set(false);
    this.isNotificationsOpen.set(false);
  }

  onSearch(): void {
    const q = this.searchQuery().trim();
    if (q) {
      this.router.navigate(['/dashboard/market'], { queryParams: { symbol: q } });
    }
  }

  logout(): void {
    this.closeDropdowns();
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
