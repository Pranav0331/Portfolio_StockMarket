import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-watchlist',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1 class="page-title">Watchlist</h1>
          <p class="page-sub">Monitor key market securities, volatility triggers, and price bands.</p>
        </div>
      </div>

      <div class="glass-panel">
        <div class="empty-state">
          <div class="empty-icon-box">
            <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="var(--text-muted)" stroke-width="1.5">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
          </div>
          <h3 class="empty-title">Watchlist is empty</h3>
          <p class="empty-desc">
            You haven't added any stocks or instruments to your watchlist yet.
          </p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page-container { display: flex; flex-direction: column; gap: 1.5rem; }
    .page-title { font-size: 1.75rem; font-weight: 800; color: var(--text-primary); }
    .page-sub { font-size: 0.92rem; color: var(--text-secondary); }
    .glass-panel {
      background: var(--bg-glass-card);
      backdrop-filter: var(--glass-blur);
      border: 1px solid var(--border-glass);
      border-radius: var(--radius-lg);
      padding: 3.5rem 1.5rem;
    }
    .empty-state { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 0.85rem; }
    .empty-icon-box {
      width: 64px; height: 64px; border-radius: 50%;
      background: var(--bg-surface-elevated);
      display: flex; align-items: center; justify-content: center;
      border: 1px solid var(--border-subtle);
    }
    .empty-title { font-size: 1.15rem; font-weight: 700; color: var(--text-primary); }
    .empty-desc { font-size: 0.88rem; color: var(--text-secondary); max-width: 420px; line-height: 1.5; }
  `]
})
export class WatchlistComponent {}
