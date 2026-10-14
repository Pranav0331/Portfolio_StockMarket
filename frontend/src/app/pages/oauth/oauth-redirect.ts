import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-oauth-redirect',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="oauth-container">
      <div class="oauth-card">
        <div class="oauth-spinner"></div>
        <h2>Authenticating...</h2>
        <p>Completing secure sign-in with Google. Please wait.</p>
      </div>
    </div>
  `,
  styles: [`
    .oauth-container {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: #0b0f19;
      color: #f1f5f9;
      font-family: inherit;
    }
    .oauth-card {
      background: rgba(30, 41, 59, 0.7);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      padding: 40px;
      text-align: center;
      max-width: 400px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
    }
    .oauth-spinner {
      width: 48px;
      height: 48px;
      margin: 0 auto 20px;
      border: 3px solid rgba(56, 189, 248, 0.2);
      border-top-color: #38bdf8;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    h2 { margin: 0 0 10px; font-size: 1.25rem; font-weight: 600; color: #f8fafc; }
    p { margin: 0; font-size: 0.875rem; color: #94a3b8; }
    @keyframes spin { to { transform: rotate(360deg); } }
  `]
})
export class OAuthRedirectComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);

  ngOnInit(): void {
    const snapshot = this.route.snapshot;
    let token = snapshot.queryParamMap.get('token');
    let email = snapshot.queryParamMap.get('email');
    let name = snapshot.queryParamMap.get('name');
    let role = snapshot.queryParamMap.get('role');
    let id = snapshot.queryParamMap.get('id');
    let error = snapshot.queryParamMap.get('error');

    // Fallback to window.location.search if router queryParamMap is not yet populated
    if (!token && typeof window !== 'undefined' && window.location.search) {
      const urlParams = new URLSearchParams(window.location.search);
      token = urlParams.get('token');
      email = urlParams.get('email');
      name = urlParams.get('name');
      role = urlParams.get('role');
      id = urlParams.get('id');
      error = urlParams.get('error');
    }

    if (error) {
      this.router.navigate(['/login'], {
        queryParams: { error: `Authentication failed: ${error}` },
        replaceUrl: true
      });
      return;
    }

    if (token && email) {
      const success = this.authService.handleOAuthCallback({
        token,
        id: id || undefined,
        email,
        name: name || undefined,
        role: role || undefined
      });

      if (success) {
        this.router.navigate(['/dashboard'], { replaceUrl: true });
        return;
      }
    }

    if (this.authService.isAuthenticated()) {
      this.router.navigate(['/dashboard'], { replaceUrl: true });
    } else {
      this.router.navigate(['/login'], { replaceUrl: true });
    }
  }
}
