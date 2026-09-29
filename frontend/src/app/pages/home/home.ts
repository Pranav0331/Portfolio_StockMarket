import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { HealthService } from '../../services/health.service';
import { HealthStatus } from '../../models/health.model';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.css'
})
export class HomeComponent {
  readonly authService = inject(AuthService);
  private readonly healthService = inject(HealthService);

  readonly healthStatus = signal<HealthStatus | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly isLoading = signal<boolean>(false);

  loginWithGoogle(): void {
    this.authService.loginWithGoogle();
  }

  scrollToSection(id: string): void {
    if (typeof document !== 'undefined') {
      const element = document.getElementById(id);
      if (element && typeof element.scrollIntoView === 'function') {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
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
