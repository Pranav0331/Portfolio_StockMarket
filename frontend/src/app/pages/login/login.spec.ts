import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { LoginComponent } from './login';
import { AuthService } from '../../services/auth.service';

describe('LoginComponent', () => {
  let authService: AuthService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([])
      ]
    }).compileComponents();

    authService = TestBed.inject(AuthService);
  });

  it('should create the login component', () => {
    const fixture = TestBed.createComponent(LoginComponent);
    const comp = fixture.componentInstance;
    expect(comp).toBeTruthy();
  });

  it('should render email, password inputs and login button', async () => {
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('#email')).toBeTruthy();
    expect(compiled.querySelector('#password')).toBeTruthy();
    expect(compiled.querySelector('#login-submit-btn')).toBeTruthy();
    expect(compiled.querySelector('#google-login-btn-page')).toBeTruthy();
    expect(compiled.querySelector('.forgot-link')).toBeTruthy();
    expect(compiled.querySelector('.switch-link')?.textContent).toContain('Sign Up');
  });

  it('should validate invalid form submission and show errors', () => {
    const fixture = TestBed.createComponent(LoginComponent);
    const comp = fixture.componentInstance;
    fixture.detectChanges();

    comp.onSubmit();
    expect(comp.loginForm.invalid).toBe(true);
    expect(comp.loginForm.get('email')?.touched).toBe(true);
    expect(comp.loginForm.get('password')?.touched).toBe(true);
  });

  it('should toggle password visibility', () => {
    const fixture = TestBed.createComponent(LoginComponent);
    const comp = fixture.componentInstance;
    expect(comp.showPassword()).toBe(false);
    comp.togglePasswordVisibility();
    expect(comp.showPassword()).toBe(true);
    comp.togglePasswordVisibility();
    expect(comp.showPassword()).toBe(false);
  });

  it('should call authService.login on valid form submission', () => {
    const fixture = TestBed.createComponent(LoginComponent);
    const comp = fixture.componentInstance;
    const loginSpy = vi.spyOn(authService, 'login').mockReturnValue(of({
      token: 'jwt.token.test',
      email: 'test@example.com',
      name: 'Test User',
      role: 'ROLE_USER'
    }));

    comp.loginForm.setValue({
      email: 'test@example.com',
      password: 'password123'
    });

    comp.onSubmit();
    expect(loginSpy).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123'
    });
  });

  it('should set error message when login fails with 401', () => {
    const fixture = TestBed.createComponent(LoginComponent);
    const comp = fixture.componentInstance;
    vi.spyOn(authService, 'login').mockReturnValue(throwError(() => ({
      status: 401,
      error: { message: 'Invalid credentials' }
    })));

    comp.loginForm.setValue({
      email: 'test@example.com',
      password: 'wrongpassword'
    });

    comp.onSubmit();
    expect(comp.errorMessage()).toContain('Invalid email or password');
  });

  it('should invoke loginWithGoogle when google button is clicked', () => {
    const fixture = TestBed.createComponent(LoginComponent);
    const comp = fixture.componentInstance;
    const googleSpy = vi.spyOn(authService, 'loginWithGoogle').mockImplementation(() => {});

    comp.loginWithGoogle();
    expect(googleSpy).toHaveBeenCalled();
  });
});
