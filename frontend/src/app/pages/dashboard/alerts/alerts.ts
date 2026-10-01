import {
  Component,
  OnInit,
  inject,
  signal,
  computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AlertService } from '../../../services/alert.service';
import { MarketService } from '../../../services/market.service';
import { AlertItem, CreateAlertRequest, UpdateAlertRequest, AlertConditionType, AlertStatusType } from '../../../models/alert.model';
import { StockSearchItem } from '../../../models/market.model';

@Component({
  selector: 'app-alerts',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './alerts.html',
  styleUrls: ['./alerts.css']
})
export class AlertsComponent implements OnInit {
  private readonly alertService = inject(AlertService);
  private readonly marketService = inject(MarketService);
  private readonly router = inject(Router);

  // Service Signals
  readonly alertsData = this.alertService.alertsData;
  readonly isLoading = this.alertService.isLoading;
  readonly error = this.alertService.error;

  // Filter & Search Signals
  readonly filterQuery = signal<string>('');
  readonly statusFilter = signal<'ALL' | 'ACTIVE' | 'TRIGGERED' | 'DISABLED'>('ALL');
  readonly conditionFilter = signal<'ALL' | 'ABOVE' | 'BELOW'>('ALL');

  // Modal & Form State
  readonly isModalOpen = signal<boolean>(false);
  readonly isEditing = signal<boolean>(false);
  readonly currentAlertId = signal<number | null>(null);

  readonly formSymbol = signal<string>('');
  readonly formCondition = signal<AlertConditionType>('ABOVE');
  readonly formTargetPrice = signal<number | null>(null);
  readonly formNotes = signal<string>('');

  readonly isSubmitting = signal<boolean>(false);
  readonly formError = signal<string | null>(null);
  readonly formSuccess = signal<string | null>(null);

  // Symbol Autocomplete
  readonly searchSuggestions = signal<StockSearchItem[]>([]);
  readonly isSearchingSymbols = signal<boolean>(false);

  // Actions State
  readonly isRefreshing = signal<boolean>(false);
  readonly deleteConfirmId = signal<number | null>(null);
  readonly previewPrice = signal<number | null>(null);

  // Popular quick symbols for quick-add pill buttons
  readonly quickSymbols = [
    { symbol: 'RELIANCE', name: 'Reliance Industries', exchange: 'NSE' },
    { symbol: 'TCS', name: 'Tata Consultancy Services', exchange: 'NSE' },
    { symbol: 'HDFCBANK', name: 'HDFC Bank', exchange: 'NSE' },
    { symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ' },
    { symbol: 'TSLA', name: 'Tesla Inc.', exchange: 'NASDAQ' },
    { symbol: 'NVDA', name: 'NVIDIA Corp.', exchange: 'NASDAQ' },
    { symbol: 'EUR/USD', name: 'Euro / US Dollar', exchange: 'FOREX' },
    { symbol: 'BTC/USD', name: 'Bitcoin / USD', exchange: 'CRYPTO' }
  ];

  // Filtered Alert Items
  readonly filteredAlerts = computed(() => {
    const data = this.alertsData();
    if (!data || !data.alerts) return [];

    let list = data.alerts;

    // Status Filter
    const st = this.statusFilter();
    if (st !== 'ALL') {
      list = list.filter((a) => a.status === st);
    }

    // Condition Filter
    const cd = this.conditionFilter();
    if (cd !== 'ALL') {
      list = list.filter((a) => a.conditionType === cd);
    }

    // Search Query
    const q = this.filterQuery().trim().toLowerCase();
    if (q) {
      list = list.filter((a) =>
        a.symbol.toLowerCase().includes(q) ||
        (a.companyName && a.companyName.toLowerCase().includes(q)) ||
        (a.exchange && a.exchange.toLowerCase().includes(q)) ||
        (a.notes && a.notes.toLowerCase().includes(q))
      );
    }

    return list;
  });

  // Summary counts
  readonly totalCount = computed(() => this.alertsData()?.totalCount ?? 0);
  readonly activeCount = computed(() => this.alertsData()?.activeCount ?? 0);
  readonly triggeredCount = computed(() => this.alertsData()?.triggeredCount ?? 0);
  readonly disabledCount = computed(() => this.alertsData()?.disabledCount ?? 0);

  ngOnInit(): void {
    this.loadAlerts();
  }

  loadAlerts(): void {
    this.alertService.getAlerts().subscribe({
      error: (err) => console.warn('Alerts fetch notification:', err)
    });
  }

  refreshAlerts(): void {
    this.isRefreshing.set(true);
    this.alertService.evaluateAlerts().subscribe({
      next: () => this.isRefreshing.set(false),
      error: () => this.isRefreshing.set(false)
    });
  }

  openCreateModal(symbol?: string): void {
    this.isEditing.set(false);
    this.currentAlertId.set(null);
    this.formSymbol.set(symbol || '');
    this.formCondition.set('ABOVE');
    this.formTargetPrice.set(null);
    this.formNotes.set('');
    this.formError.set(null);
    this.formSuccess.set(null);
    this.searchSuggestions.set([]);
    this.previewPrice.set(null);
    this.isModalOpen.set(true);

    if (symbol) {
      this.fetchQuotePreview(symbol);
    }
  }

  openEditModal(alert: AlertItem): void {
    this.isEditing.set(true);
    this.currentAlertId.set(alert.id);
    this.formSymbol.set(alert.symbol);
    this.formCondition.set(alert.conditionType);
    this.formTargetPrice.set(alert.targetPrice);
    this.formNotes.set(alert.notes || '');
    this.formError.set(null);
    this.formSuccess.set(null);
    this.searchSuggestions.set([]);
    this.previewPrice.set(alert.currentPrice);
    this.isModalOpen.set(true);
  }

  closeModal(): void {
    this.isModalOpen.set(false);
    this.formError.set(null);
    this.formSuccess.set(null);
    this.searchSuggestions.set([]);
  }

  onSymbolSearch(query: string): void {
    this.formSymbol.set(query);
    this.formError.set(null);

    const clean = query.trim();
    if (!clean || clean.length < 2) {
      this.searchSuggestions.set([]);
      this.isSearchingSymbols.set(false);
      return;
    }

    this.isSearchingSymbols.set(true);
    this.marketService.searchSymbols(clean).subscribe({
      next: (res) => {
        this.searchSuggestions.set(res?.bestMatches?.slice(0, 6) || []);
        this.isSearchingSymbols.set(false);
      },
      error: () => {
        this.searchSuggestions.set([]);
        this.isSearchingSymbols.set(false);
      }
    });


    this.fetchQuotePreview(clean);
  }

  selectSuggestion(item: StockSearchItem): void {
    this.formSymbol.set(item.symbol);
    this.searchSuggestions.set([]);
    this.fetchQuotePreview(item.symbol);
  }

  selectQuickSymbol(symbol: string): void {
    this.formSymbol.set(symbol);
    this.fetchQuotePreview(symbol);
  }

  private fetchQuotePreview(symbol: string): void {
    if (!symbol) return;
    this.marketService.getQuote(symbol).subscribe({
      next: (q) => {
        if (q && q.price) {
          this.previewPrice.set(q.price);
          if (!this.formTargetPrice()) {
            // Suggest initial target price 5% higher
            const base = q.price;
            const mult = this.formCondition() === 'ABOVE' ? 1.05 : 0.95;
            this.formTargetPrice.set(Math.round(base * mult * 100) / 100);
          }
        }
      },
      error: () => this.previewPrice.set(null)
    });
  }

  saveAlert(): void {
    const symbol = this.formSymbol().trim().toUpperCase();
    const targetPrice = this.formTargetPrice();
    const condition = this.formCondition();
    const notes = this.formNotes().trim();

    if (!symbol) {
      this.formError.set('Please provide a valid ticker symbol');
      return;
    }

    if (!targetPrice || targetPrice <= 0) {
      this.formError.set('Target price must be greater than 0');
      return;
    }

    this.isSubmitting.set(true);
    this.formError.set(null);

    if (this.isEditing()) {
      const id = this.currentAlertId();
      if (!id) return;

      const req: UpdateAlertRequest = {
        condition,
        targetPrice,
        notes,
        status: 'ACTIVE' // re-activate on edit
      };

      this.alertService.updateAlert(id, req).subscribe({
        next: () => {
          this.isSubmitting.set(false);
          this.closeModal();
        },
        error: (err) => {
          this.isSubmitting.set(false);
          this.formError.set(err.error?.message || err.message || 'Failed to update alert');
        }
      });
    } else {
      const req: CreateAlertRequest = {
        symbol,
        condition,
        targetPrice,
        notes
      };

      this.alertService.createAlert(req).subscribe({
        next: () => {
          this.isSubmitting.set(false);
          this.closeModal();
        },
        error: (err) => {
          this.isSubmitting.set(false);
          this.formError.set(err.error?.message || err.message || 'Failed to create alert');
        }
      });
    }
  }

  toggleAlert(alert: AlertItem, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.alertService.toggleAlert(alert.id).subscribe({
      error: (err) => console.error('Failed to toggle alert:', err)
    });
  }

  promptDelete(id: number, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.deleteConfirmId.set(id);
  }

  cancelDelete(): void {
    this.deleteConfirmId.set(null);
  }

  executeDelete(id: number): void {
    this.alertService.deleteAlert(id).subscribe({
      next: () => this.deleteConfirmId.set(null),
      error: () => this.deleteConfirmId.set(null)
    });
  }

  getDistancePercent(currentPrice: number | null, targetPrice: number): number | null {
    if (!currentPrice || currentPrice <= 0 || !targetPrice || targetPrice <= 0) {
      return null;
    }
    return ((currentPrice - targetPrice) / targetPrice) * 100;
  }

  getConditionIcon(cond: AlertConditionType): string {
    return cond === 'ABOVE' ? '▲' : '▼';
  }

  navigateToStock(symbol: string): void {
    this.router.navigate(['/dashboard/stock', symbol]);
  }

  navigateToTechnical(symbol: string): void {
    this.router.navigate(['/dashboard/technical', symbol]);
  }
}
