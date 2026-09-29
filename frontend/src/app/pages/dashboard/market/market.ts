import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-market',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1 class="page-title">Market Intelligence</h1>
          <p class="page-sub">Global stock exchanges, indices telemetry, and sector analysis.</p>
        </div>
      </div>

      <div class="glass-panel">
        <div class="empty-state">
          <div class="empty-icon-box">
            <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="var(--text-muted)" stroke-width="1.5">
              <path d="M3 3v18h18"></path>
              <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"></path>
            </svg>
          </div>
          <h3 class="empty-title">Market Telemetry Ready</h3>
          <p class="empty-desc">
            No live data feed connected. Configure your market data provider to stream real-time price feeds and index movements.
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
      padding: 3rem 1.5rem;
    }
    .empty-state { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 0.75rem; }
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
export class MarketComponent {}
