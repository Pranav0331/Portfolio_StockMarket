import {
  Component,
  OnInit,
  OnDestroy,
  AfterViewInit,
  ElementRef,
  ViewChild,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  LineSeries,
  AreaSeries,
  Time,
  ColorType
} from 'lightweight-charts';
import { RiskService } from '../../../services/risk.service';
import { PortfolioRisk } from '../../../models/risk.model';

@Component({
  selector: 'app-risk',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './risk.html',
  styleUrls: ['./risk.css']
})
export class RiskComponent implements OnInit, OnDestroy, AfterViewInit {
  private readonly riskService = inject(RiskService);
  private readonly router = inject(Router);

  @ViewChild('riskChartContainer') riskChartContainer?: ElementRef<HTMLDivElement>;

  readonly riskData = signal<PortfolioRisk | null>(null);
  readonly isLoading = signal<boolean>(false);
  readonly error = signal<string | null>(null);
  readonly selectedMetric = signal<'drawdown' | 'volatility' | 'both'>('both');

  private riskChart?: IChartApi;
  private drawdownSeries?: ISeriesApi<'Area'>;
  private volSeries?: ISeriesApi<'Line'>;
  private resizeObserver?: ResizeObserver;

  ngOnInit(): void {
    this.loadRiskData();
  }

  ngAfterViewInit(): void {
    if (typeof window !== 'undefined' && 'ResizeObserver' in window) {
      this.resizeObserver = new ResizeObserver(() => {
        this.handleResize();
      });
      if (this.riskChartContainer?.nativeElement) {
        this.resizeObserver.observe(this.riskChartContainer.nativeElement);
      }
    }
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.destroyChart();
  }

  loadRiskData(): void {
    this.isLoading.set(true);
    this.error.set(null);

    this.riskService.getPortfolioRisk().subscribe({
      next: (data) => {
        this.riskData.set(data);
        this.isLoading.set(false);
        this.error.set(null);

        setTimeout(() => {
          this.initOrUpdateChart(data);
        }, 50);
      },
      error: (err) => {
        this.isLoading.set(false);
        const msg = err?.error?.message || err?.message || 'Failed to load portfolio risk analysis. Please try again.';
        this.error.set(msg);
      }
    });
  }

  refreshRisk(): void {
    this.loadRiskData();
  }

  navigateToStock(symbol: string): void {
    if (!symbol) return;
    this.router.navigate(['/dashboard/stock', symbol]);
  }

  setMetricView(view: 'drawdown' | 'volatility' | 'both'): void {
    this.selectedMetric.set(view);
    const data = this.riskData();
    if (data) {
      this.initOrUpdateChart(data);
    }
  }

  getCurrencySymbol(currency?: string): string {
    if (currency === 'INR') return '₹';
    if (currency === 'EUR') return '€';
    if (currency === 'GBP') return '£';
    return '$';
  }

  getRiskRatingBadgeClass(rating: string): string {
    if (!rating) return 'badge-neutral';
    const clean = rating.toLowerCase();
    if (clean.includes('low')) return 'badge-low-risk';
    if (clean.includes('mod')) return 'badge-mod-risk';
    if (clean.includes('high')) return 'badge-high-risk';
    return 'badge-neutral';
  }

  getDiversificationBadgeClass(rating: string): string {
    if (!rating) return 'badge-neutral';
    const clean = rating.toLowerCase();
    if (clean.includes('well') || clean.includes('high div')) return 'badge-low-risk';
    if (clean.includes('moderate')) return 'badge-mod-risk';
    if (clean.includes('concentrated') || clean.includes('undiversified')) return 'badge-high-risk';
    return 'badge-neutral';
  }

  getHhiMeterWidth(hhi: number | null): string {
    if (hhi === null || hhi === undefined) return '0%';
    const pct = Math.min(100, Math.max(0, (hhi / 10000) * 100));
    return `${pct.toFixed(1)}%`;
  }

  // ==========================================================================
  // CHART MANAGEMENT
  // ==========================================================================
  private initOrUpdateChart(data: PortfolioRisk): void {
    if (!this.riskChartContainer?.nativeElement) return;
    if (!data.historicalRiskSeries || data.historicalRiskSeries.length === 0) {
      this.destroyChart();
      return;
    }

    try {
      if (!this.riskChart) {
        const container = this.riskChartContainer.nativeElement;
        const width = container.clientWidth || 800;
        const height = 360;

        const isLight = typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'light';
        const textColor = isLight ? '#334155' : '#94a3b8';
        const gridColor = isLight ? 'rgba(15, 23, 42, 0.08)' : 'rgba(255, 255, 255, 0.05)';
        const borderColor = isLight ? 'rgba(15, 23, 42, 0.12)' : 'rgba(255, 255, 255, 0.1)';

        this.riskChart = createChart(container, {
          width,
          height,
          layout: {
            background: { type: ColorType.Solid, color: 'transparent' },
            textColor
          },
          grid: {
            vertLines: { color: gridColor },
            horzLines: { color: gridColor }
          },
          timeScale: {
            borderColor,
            timeVisible: true
          }
        });

        this.drawdownSeries = this.riskChart.addSeries(AreaSeries, {
          topColor: 'rgba(239, 68, 68, 0.4)',
          bottomColor: 'rgba(239, 68, 68, 0.02)',
          lineColor: '#ef4444',
          lineWidth: 2
        });

        this.volSeries = this.riskChart.addSeries(LineSeries, {
          color: '#38bdf8',
          lineWidth: 2
        });
      }

      const points = data.historicalRiskSeries;
      const metric = this.selectedMetric();

      if (this.drawdownSeries) {
        if (metric === 'both' || metric === 'drawdown') {
          const ddData = points.map(p => ({
            time: (p.timestamp as unknown) as Time,
            value: -(p.drawdownPercent || 0)
          }));
          this.drawdownSeries.setData(ddData);
        } else {
          this.drawdownSeries.setData([]);
        }
      }

      if (this.volSeries) {
        if (metric === 'both' || metric === 'volatility') {
          const volData = points.map(p => ({
            time: (p.timestamp as unknown) as Time,
            value: p.rollingVolatilityPercent || 0
          }));
          this.volSeries.setData(volData);
        } else {
          this.volSeries.setData([]);
        }
      }

      this.riskChart.timeScale().fitContent();
    } catch (e) {
      // safe fallback in test/headless environments
    }
  }

  private handleResize(): void {
    if (this.riskChartContainer?.nativeElement && this.riskChart) {
      const width = this.riskChartContainer.nativeElement.clientWidth;
      this.riskChart.applyOptions({ width });
    }
  }

  private destroyChart(): void {
    try {
      this.riskChart?.remove();
      this.riskChart = undefined;
      this.drawdownSeries = undefined;
      this.volSeries = undefined;
    } catch (e) {}
  }
}
