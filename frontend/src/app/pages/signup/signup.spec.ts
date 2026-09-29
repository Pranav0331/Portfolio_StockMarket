import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { SignupComponent } from './signup';
import { AuthService } from '../../services/auth.service';

describe('SignupComponent', () => {
  let authService: AuthService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SignupComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([])
      ]
    }).compileComponents();

    authService = TestBed.inject(AuthService);
  });

  it('should create the signup component', () => {
    const fixture = TestBed.createComponent(SignupComponent);
    const comp = fixture.componentInstance;
    expect(comp).toBeTruthy();
  });

  it('should render full name, email, password, and confirm password inputs', async () => {
    const fixture = TestBed.createComponent(SignupComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('#name')).toBeTruthy();
    expect(compiled.querySelector('#email')).toBeTruthy();
    expect(compiled.querySelector('#password')).toBeTruthy();
    expect(compiled.querySelector('#confirmPassword')).toBeTruthy();
    expect(compiled.querySelector('#signup-submit-btn')).toBeTruthy();
    expect(compiled.querySelector('#google-signup-btn-page')).toBeTruthy();
    expect(compiled.querySelector('.switch-link')?.textContent).toContain('Login');
  });

  it('should validate password mismatch', () => {
    const fixture = TestBed.createComponent(SignupComponent);
    const comp = fixture.componentInstance;

    comp.signupForm.setValue({
      name: 'Alex Morgan',
      email: 'alex@example.com',
      password: 'password123',
      confirmPassword: 'differentpassword'
    });

    expect(comp.signupForm.hasError('passwordMismatch')).toBe(true);
    expect(comp.signupForm.valid).toBe(false);
  });

  it('should call authService.register on valid form submission', () => {
    const fixture = TestBed.createComponent(SignupComponent);
    const comp = fixture.componentInstance;
    const registerSpy = vi.spyOn(authService, 'register').mockReturnValue(of({
      id: 10,
      name: 'Alex Morgan',
      email: 'alex@example.com',
      message: 'User registered successfully'
    }));
    const loginSpy = vi.spyOn(authService, 'login').mockReturnValue(of({
      token: 'jwt.token.test',
      email: 'alex@example.com'
    }));

    comp.signupForm.setValue({
      name: 'Alex Morgan',
      email: 'alex@example.com',
      password: 'password123',
      confirmPassword: 'password123'
    });

    comp.onSubmit();
    expect(registerSpy).toHaveBeenCalledWith({
      name: 'Alex Morgan',
      email: 'alex@example.com',
      password: 'password123',
      confirmPassword: 'password123'
    });
    expect(loginSpy).toHaveBeenCalled();
  });

  it('should handle registration email conflict (409)', () => {
    const fixture = TestBed.createComponent(SignupComponent);
    const comp = fixture.componentInstance;
    vi.spyOn(authService, 'register').mockReturnValue(throwError(() => ({
      status: 409,
      error: { message: 'Email is already registered' }
    })));

    comp.signupForm.setValue({
      name: 'Alex Morgan',
      email: 'existing@example.com',
      password: 'password123',
      confirmPassword: 'password123'
    });

    comp.onSubmit();
    expect(comp.errorMessage()).toContain('already registered');
  });
});
