import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

export const passwordMatchValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const password = control.get('password')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;
  if (password && confirmPassword && password !== confirmPassword) {
    return { passwordMismatch: true };
  }
  return null;
};

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './signup.html',
  styleUrl: './signup.css'
})
export class SignupComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly signupForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(100)]],
    confirmPassword: ['', [Validators.required]]
  }, { validators: passwordMatchValidator });

  readonly showPassword = signal<boolean>(false);
  readonly showConfirmPassword = signal<boolean>(false);
  readonly isLoading = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  togglePasswordVisibility(): void {
    this.showPassword.update((val) => !val);
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword.update((val) => !val);
  }

  onSubmit(): void {
    if (this.signupForm.invalid) {
      this.signupForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    const { name, email, password, confirmPassword } = this.signupForm.getRawValue();

    this.authService.register({
      name: name!,
      email: email!,
      password: password!,
      confirmPassword: confirmPassword!
    }).subscribe({
      next: (res) => {
        this.successMessage.set('Account created successfully! Logging you in...');
        // Automatically log in with credentials
        this.authService.login({ email: email!, password: password! }).subscribe({
          next: () => {
            this.isLoading.set(false);
            this.router.navigate(['/']);
          },
          error: () => {
            this.isLoading.set(false);
            this.router.navigate(['/login']);
          }
        });
      },
      error: (err) => {
        this.isLoading.set(false);
        const backendMsg = err.error?.message || err.error?.detail || err.message;
        if (err.status === 409) {
          this.errorMessage.set('This email address is already registered. Please login instead.');
        } else if (err.status === 400) {
          this.errorMessage.set(backendMsg || 'Invalid registration details. Please check the form.');
        } else {
          this.errorMessage.set(backendMsg || 'Unable to register account. Please check your backend connection.');
        }
      }
    });
  }

  loginWithGoogle(): void {
    this.authService.loginWithGoogle();
  }
}
