import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

interface WatchItem {
  symbol: string;
  name: string;
  category: string;
  exchange: string;
  currency: string;
}

@Component({
  selector: 'app-watchlist',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1 class="page-title">Watchlist</h1>
          <p class="page-sub">Monitor key market securities, volatility triggers, and price bands.</p>
        </div>
      </div>

      <div class="watchlist-grid">
        @for (item of items(); track item.symbol) {
          <a [routerLink]="['/dashboard/stock', item.symbol]" class="watch-card">
            <div class="card-left">
              <div class="sym-badge">{{ item.symbol }}</div>
              <div class="info-group">
                <span class="stock-name">{{ item.name }}</span>
                <span class="stock-meta">{{ item.exchange }} • {{ item.category }}</span>
              </div>
            </div>
            <div class="card-right">
              <span class="btn-view-details">
                <span>View Details</span>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                  <polyline points="12 5 19 12 12 19"></polyline>
                </svg>
              </span>
            </div>
          </a>
        }
      </div>
    </div>
  `,
  styles: [`
    .page-container { display: flex; flex-direction: column; gap: 1.5rem; max-width: 1200px; margin: 0 auto; }
    .page-title { font-size: 1.75rem; font-weight: 800; color: var(--text-primary); }
    .page-sub { font-size: 0.92rem; color: var(--text-secondary); }
    .watchlist-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 1rem;
    }
    .watch-card {
      background: var(--bg-glass-card);
      backdrop-filter: var(--glass-blur);
      border: 1px solid var(--border-glass);
      border-radius: var(--radius-lg, 12px);
      padding: 1.25rem 1.5rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      text-decoration: none;
      transition: all 0.2s ease;
    }
    .watch-card:hover {
      border-color: var(--primary-color, #38bdf8);
      transform: translateY(-2px);
      box-shadow: 0 8px 24px -6px rgba(0, 0, 0, 0.3);
    }
    .card-left {
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    .sym-badge {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.92rem;
      font-weight: 800;
      color: #38bdf8;
      background: rgba(56, 189, 248, 0.12);
      border: 1px solid rgba(56, 189, 248, 0.3);
      padding: 0.35rem 0.65rem;
      border-radius: 6px;
    }
    .info-group {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
    }
    .stock-name {
      font-size: 0.95rem;
      font-weight: 700;
      color: var(--text-primary);
    }
    .stock-meta {
      font-size: 0.78rem;
      color: var(--text-muted);
    }
    .btn-view-details {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      font-size: 0.78rem;
      font-weight: 600;
      color: var(--text-secondary);
      padding: 0.35rem 0.7rem;
      border-radius: 6px;
      background: var(--bg-surface-elevated);
      border: 1px solid var(--border-subtle);
      transition: all 0.15s ease;
    }
    .watch-card:hover .btn-view-details {
      color: #38bdf8;
      border-color: rgba(56, 189, 248, 0.4);
    }
  `]
})
export class WatchlistComponent {
  readonly items = signal<WatchItem[]>([
    { symbol: 'RELIANCE', name: 'Reliance Industries', category: 'Stock', exchange: 'NSE', currency: 'INR' },
    { symbol: 'TCS', name: 'Tata Consultancy Services', category: 'Stock', exchange: 'NSE', currency: 'INR' },
    { symbol: 'NIFTY 50', name: 'Nifty 50 Index', category: 'Index', exchange: 'NSE', currency: 'INR' },
    { symbol: 'BANK NIFTY', name: 'Nifty Bank Index', category: 'Index', exchange: 'NSE', currency: 'INR' },
    { symbol: 'AAPL', name: 'Apple Inc.', category: 'Stock', exchange: 'NASDAQ', currency: 'USD' },
    { symbol: 'NVDA', name: 'NVIDIA Corporation', category: 'Stock', exchange: 'NASDAQ', currency: 'USD' },
    { symbol: 'EUR/USD', name: 'Euro / US Dollar', category: 'Forex', exchange: 'Forex', currency: 'USD' },
    { symbol: 'BTC/USD', name: 'Bitcoin / US Dollar', category: 'Crypto', exchange: 'Coinbase', currency: 'USD' }
  ]);
}
