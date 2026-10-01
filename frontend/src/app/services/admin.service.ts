import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  AdminDashboardSummary,
  AdminUser,
  AdminOrder,
  AdminTransaction,
  UpdateUserStatusRequest,
  UpdateUserRoleRequest
} from '../models/admin.model';

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/admin`;

  // Reactive state signals
  readonly summaryData = signal<AdminDashboardSummary | null>(null);
  readonly usersList = signal<AdminUser[]>([]);
  readonly ordersList = signal<AdminOrder[]>([]);
  readonly transactionsList = signal<AdminTransaction[]>([]);
  readonly isLoading = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  /**
   * Fetch system dashboard summary metrics and recent activity
   */
  getDashboardSummary(): Observable<AdminDashboardSummary> {
    this.isLoading.set(true);
    this.error.set(null);

    return this.http.get<AdminDashboardSummary>(`${this.baseUrl}/summary`).pipe(
      tap((data) => {
        this.summaryData.set(data);
        this.isLoading.set(false);
      }),
      catchError((err) => {
        this.isLoading.set(false);
        const msg = err.error?.message || err.message || 'Failed to load admin summary';
        this.error.set(msg);
        return throwError(() => err);
      })
    );
  }

  /**
   * Fetch filtered list of all system users
   */
  getUsers(query?: string, role?: string, status?: string): Observable<AdminUser[]> {
    this.isLoading.set(true);
    this.error.set(null);

    let params = new HttpParams();
    if (query && query.trim()) {
      params = params.set('query', query.trim());
    }
    if (role && role !== 'ALL') {
      params = params.set('role', role);
    }
    if (status && status !== 'ALL') {
      params = params.set('status', status);
    }

    return this.http.get<AdminUser[]>(`${this.baseUrl}/users`, { params }).pipe(
      tap((users) => {
        this.usersList.set(users);
        this.isLoading.set(false);
      }),
      catchError((err) => {
        this.isLoading.set(false);
        const msg = err.error?.message || err.message || 'Failed to load users';
        this.error.set(msg);
        return throwError(() => err);
      })
    );
  }

  /**
   * Fetch specific user details by ID
   */
  getUserById(id: number): Observable<AdminUser> {
    return this.http.get<AdminUser>(`${this.baseUrl}/users/${id}`);
  }

  /**
   * Update user status (ACTIVE, INACTIVE, SUSPENDED)
   */
  updateUserStatus(id: number, status: string): Observable<AdminUser> {
    const req: UpdateUserStatusRequest = { status };
    return this.http.patch<AdminUser>(`${this.baseUrl}/users/${id}/status`, req).pipe(
      tap((updated) => {
        // Update user in usersList
        this.usersList.update((list) => list.map((u) => (u.id === id ? updated : u)));
        // Refresh summary stats if available
        const currentSummary = this.summaryData();
        if (currentSummary) {
          this.getDashboardSummary().subscribe();
        }
      })
    );
  }

  /**
   * Update user role (ROLE_USER, ROLE_ADMIN)
   */
  updateUserRole(id: number, role: string): Observable<AdminUser> {
    const req: UpdateUserRoleRequest = { role };
    return this.http.patch<AdminUser>(`${this.baseUrl}/users/${id}/role`, req).pipe(
      tap((updated) => {
        this.usersList.update((list) => list.map((u) => (u.id === id ? updated : u)));
      })
    );
  }

  /**
   * Fetch recent system orders
   */
  getOrders(limit = 50): Observable<AdminOrder[]> {
    this.isLoading.set(true);
    const params = new HttpParams().set('limit', limit.toString());
    return this.http.get<AdminOrder[]>(`${this.baseUrl}/orders`, { params }).pipe(
      tap((orders) => {
        this.ordersList.set(orders);
        this.isLoading.set(false);
      }),
      catchError((err) => {
        this.isLoading.set(false);
        return throwError(() => err);
      })
    );
  }

  /**
   * Fetch recent system transactions
   */
  getTransactions(limit = 50): Observable<AdminTransaction[]> {
    this.isLoading.set(true);
    const params = new HttpParams().set('limit', limit.toString());
    return this.http.get<AdminTransaction[]>(`${this.baseUrl}/transactions`, { params }).pipe(
      tap((txs) => {
        this.transactionsList.set(txs);
        this.isLoading.set(false);
      }),
      catchError((err) => {
        this.isLoading.set(false);
        return throwError(() => err);
      })
    );
  }
}
