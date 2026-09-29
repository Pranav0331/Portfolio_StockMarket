import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1 class="page-title">Account & Security Settings</h1>
          <p class="page-sub">Manage profile credentials, session authentication, and preferences.</p>
        </div>
      </div>

      <div class="settings-grid">
        <div class="glass-card">
          <h2 class="card-title">User Profile</h2>
          <div class="profile-info-grid">
            <div class="info-row">
              <span class="info-label">Full Name</span>
              <span class="info-value">{{ authService.currentUser()?.name || 'Investor' }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Email Address</span>
              <span class="info-value">{{ authService.currentUser()?.email || 'N/A' }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Account Role</span>
              <span class="badge">{{ authService.currentUser()?.role || 'ROLE_USER' }}</span>
            </div>
          </div>
        </div>

        <div class="glass-card">
          <h2 class="card-title">Security & API Keys</h2>
          <p class="card-desc">
            Authentication token is securely managed via Spring Boot JWT and Spring Security OAuth 2.0.
          </p>
          <div class="token-status">
            <span class="status-dot"></span>
            <span>Active Session Token</span>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page-container { display: flex; flex-direction: column; gap: 1.5rem; }
    .page-title { font-size: 1.75rem; font-weight: 800; color: var(--text-primary); }
    .page-sub { font-size: 0.92rem; color: var(--text-secondary); }
    .settings-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
    .glass-card {
      background: var(--bg-glass-card);
      backdrop-filter: var(--glass-blur);
      border: 1px solid var(--border-glass);
      border-radius: var(--radius-lg);
      padding: 1.75rem;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }
    .card-title { font-size: 1.15rem; font-weight: 700; color: var(--text-primary); }
    .card-desc { font-size: 0.88rem; color: var(--text-secondary); line-height: 1.5; }
    .profile-info-grid { display: flex; flex-direction: column; gap: 0.85rem; }
    .info-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 0.65rem;
      border-bottom: 1px solid var(--border-subtle);
    }
    .info-label { font-size: 0.85rem; color: var(--text-muted); }
    .info-value { font-size: 0.9rem; font-weight: 600; color: var(--text-primary); }
    .badge {
      font-size: 0.72rem;
      font-family: var(--font-mono);
      padding: 0.2rem 0.55rem;
      border-radius: var(--radius-sm);
      background: var(--accent-emerald-bg);
      color: var(--accent-emerald);
      border: 1px solid rgba(16, 185, 129, 0.3);
    }
    .token-status {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.82rem;
      color: var(--text-muted);
    }
    .status-dot {
      width: 8px; height: 8px; border-radius: 50%;
      background: var(--accent-emerald);
      box-shadow: 0 0 8px var(--accent-emerald);
    }
    @media (max-width: 768px) {
      .settings-grid { grid-template-columns: 1fr; }
    }
  `]
})
export class SettingsComponent {
  readonly authService = inject(AuthService);
}
