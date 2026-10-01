import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { AlertsResponse, AlertItem, CreateAlertRequest, UpdateAlertRequest } from '../models/alert.model';

@Injectable({
  providedIn: 'root'
})
export class AlertService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/alerts`;

  // Reactive state signals
  readonly alertsData = signal<AlertsResponse | null>(null);
  readonly isLoading = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  /**
   * Fetch all price alerts for the authenticated user and evaluate against real market data
   */
  getAlerts(): Observable<AlertsResponse> {
    this.isLoading.set(true);
    this.error.set(null);

    return this.http.get<AlertsResponse>(this.baseUrl).pipe(
      tap((data) => {
        this.alertsData.set(data);
        this.isLoading.set(false);
      }),
      catchError((err) => {
        this.isLoading.set(false);
        const msg = err.error?.message || err.message || 'Failed to load price alerts';
        this.error.set(msg);
        return throwError(() => err);
      })
    );
  }

  /**
   * Create a new price alert for a symbol
   */
  createAlert(req: CreateAlertRequest): Observable<AlertItem> {
    this.error.set(null);
    return this.http.post<AlertItem>(this.baseUrl, req).pipe(
      tap((newItem) => {
        const current = this.alertsData();
        if (current) {
          const updatedAlerts = [newItem, ...current.alerts.filter((a) => a.id !== newItem.id)];
          this.recalculateSummary(updatedAlerts);
        }
      }),
      catchError((err) => {
        const msg = err.error?.message || err.message || 'Failed to create price alert';
        this.error.set(msg);
        return throwError(() => err);
      })
    );
  }

  /**
   * Update an existing price alert
   */
  updateAlert(id: number, req: UpdateAlertRequest): Observable<AlertItem> {
    this.error.set(null);
    return this.http.put<AlertItem>(`${this.baseUrl}/${id}`, req).pipe(
      tap((updatedItem) => {
        const current = this.alertsData();
        if (current) {
          const updatedAlerts = current.alerts.map((a) => (a.id === id ? updatedItem : a));
          this.recalculateSummary(updatedAlerts);
        }
      }),
      catchError((err) => {
        const msg = err.error?.message || err.message || 'Failed to update price alert';
        this.error.set(msg);
        return throwError(() => err);
      })
    );
  }

  /**
   * Toggle alert status between ACTIVE and DISABLED
   */
  toggleAlert(id: number): Observable<AlertItem> {
    this.error.set(null);
    return this.http.patch<AlertItem>(`${this.baseUrl}/${id}/toggle`, {}).pipe(
      tap((toggledItem) => {
        const current = this.alertsData();
        if (current) {
          const updatedAlerts = current.alerts.map((a) => (a.id === id ? toggledItem : a));
          this.recalculateSummary(updatedAlerts);
        }
      }),
      catchError((err) => {
        const msg = err.error?.message || err.message || 'Failed to toggle price alert';
        this.error.set(msg);
        return throwError(() => err);
      })
    );
  }

  /**
   * Delete a price alert
   */
  deleteAlert(id: number): Observable<{ message: string }> {
    this.error.set(null);
    return this.http.delete<{ message: string }>(`${this.baseUrl}/${id}`).pipe(
      tap(() => {
        const current = this.alertsData();
        if (current) {
          const updatedAlerts = current.alerts.filter((a) => a.id !== id);
          this.recalculateSummary(updatedAlerts);
        }
      }),
      catchError((err) => {
        const msg = err.error?.message || err.message || 'Failed to delete price alert';
        this.error.set(msg);
        return throwError(() => err);
      })
    );
  }

  /**
   * Force evaluate all user price alerts against live market data
   */
  evaluateAlerts(): Observable<AlertsResponse> {
    this.isLoading.set(true);
    this.error.set(null);
    return this.http.post<AlertsResponse>(`${this.baseUrl}/evaluate`, {}).pipe(
      tap((data) => {
        this.alertsData.set(data);
        this.isLoading.set(false);
      }),
      catchError((err) => {
        this.isLoading.set(false);
        const msg = err.error?.message || err.message || 'Failed to evaluate price alerts';
        this.error.set(msg);
        return throwError(() => err);
      })
    );
  }

  private recalculateSummary(alerts: AlertItem[]): void {
    const activeCount = alerts.filter((a) => a.status === 'ACTIVE').length;
    const triggeredCount = alerts.filter((a) => a.status === 'TRIGGERED').length;
    const disabledCount = alerts.filter((a) => a.status === 'DISABLED').length;

    this.alertsData.set({
      alerts,
      totalCount: alerts.length,
      activeCount,
      triggeredCount,
      disabledCount,
      lastEvaluatedAt: Date.now()
    });
  }
}
