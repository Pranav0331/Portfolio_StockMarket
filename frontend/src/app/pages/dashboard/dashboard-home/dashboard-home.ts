import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-dashboard-home',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard-home.html',
  styleUrl: './dashboard-home.css'
})
export class DashboardHomeComponent {
  readonly authService = inject(AuthService);

  readonly activeTab = signal<'indices' | 'gainers' | 'losers' | 'volume'>('indices');
  readonly holdings = signal<any[]>([]);
  readonly watchlist = signal<any[]>([]);
  readonly recentTransactions = signal<any[]>([]);

  setActiveTab(tab: 'indices' | 'gainers' | 'losers' | 'volume'): void {
    this.activeTab.set(tab);
  }
}
