import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  readonly showPassword = signal<boolean>(false);
  readonly isLoading = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  readonly forgotPasswordOpen = signal<boolean>(false);
  readonly forgotPasswordSent = signal<boolean>(false);

  togglePasswordVisibility(): void {
    this.showPassword.update((val) => !val);
  }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    const { email, password } = this.loginForm.getRawValue();

    this.authService.login({ email: email!, password: password! }).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.isLoading.set(false);
        const backendMsg = err.error?.message || err.error?.detail || err.message;
        if (err.status === 401) {
          this.errorMessage.set('Invalid email or password. Please try again.');
        } else if (err.status === 400) {
          this.errorMessage.set(backendMsg || 'Invalid login request details.');
        } else {
          this.errorMessage.set(backendMsg || 'Unable to sign in. Please verify your backend connectivity.');
        }
      }
    });
  }

  loginWithGoogle(): void {
    this.authService.loginWithGoogle();
  }

  openForgotPassword(): void {
    this.forgotPasswordOpen.set(true);
    this.forgotPasswordSent.set(false);
  }

  closeForgotPassword(): void {
    this.forgotPasswordOpen.set(false);
    this.forgotPasswordSent.set(false);
  }

  handleForgotPasswordSubmit(): void {
    this.forgotPasswordSent.set(true);
  }
}
