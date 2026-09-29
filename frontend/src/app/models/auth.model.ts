export interface AuthUser {
  id?: number;
  name?: string;
  email?: string;
  role?: string;
  token?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface AuthResponse {
  token?: string;
  type?: string;
  id?: number;
  name?: string;
  email?: string;
  role?: string;
  message?: string;
}
