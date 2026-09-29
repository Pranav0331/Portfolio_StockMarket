import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { HealthService } from './services/health.service';
import { HealthStatus } from './models/health.model';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  private readonly healthService = inject(HealthService);

  readonly title = signal('Portfolio StockMarket');
  readonly healthStatus = signal<HealthStatus | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly isLoading = signal<boolean>(false);

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
