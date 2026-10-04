import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { PortfolioService } from '../../../services/portfolio.service';
import { TradingService } from '../../../services/trading.service';
import { PortfolioSummary, PositionItem } from '../../../models/trading.model';

@Component({
  selector: 'app-portfolio',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './portfolio.html',
  styleUrls: ['./portfolio.css']
})
export class PortfolioComponent implements OnInit {
  private readonly portfolioService = inject(PortfolioService);
  readonly tradingService = inject(TradingService);
  private readonly router = inject(Router);

  readonly portfolio = signal<PortfolioSummary | null>(null);
  readonly openPositions = signal<PositionItem[]>([]);
  readonly isLoading = signal<boolean>(false);
  readonly error = signal<string | null>(null);
  readonly closingPositionId = signal<number | null>(null);
  readonly positionActionMsg = signal<{ type: 'success' | 'error'; text: string } | null>(null);

  // Manage Paper Balance Modal State
  readonly showManageBalanceModal = signal<boolean>(false);
  readonly balanceActionTab = signal<'deposit' | 'reset'>('deposit');
  readonly depositAmount = signal<number>(10000);
  readonly resetTargetAmount = signal<number>(100000);
  readonly isManagingBalance = signal<boolean>(false);
  readonly manageBalanceSuccess = signal<string | null>(null);
  readonly manageBalanceError = signal<string | null>(null);

  ngOnInit(): void {
    this.loadPortfolio();
  }

  loadPortfolio(): void {
    this.isLoading.set(true);
    this.error.set(null);

    this.portfolioService.getPortfolio().subscribe({
      next: (data) => {
        this.portfolio.set(data);
        this.isLoading.set(false);
        this.error.set(null);
      },
      error: (err) => {
        this.isLoading.set(false);
        const errorMsg = err?.error?.message || err?.message || 'Failed to load portfolio data. Please try again.';
        this.error.set(errorMsg);
      }
    });

    this.tradingService.getPositions('OPEN').subscribe({
      next: (pos) => {
        this.openPositions.set(pos);
      },
      error: () => {}
    });
  }

  closePosition(pos: PositionItem): void {
    if (!pos || this.closingPositionId() === pos.id) return;
    this.closingPositionId.set(pos.id);
    this.positionActionMsg.set(null);

    this.tradingService.closePosition(pos.id).subscribe({
      next: (resp) => {
        this.closingPositionId.set(null);
        const pnlStr = resp.realizedPnl != null ? (resp.realizedPnl >= 0 ? '+' : '') + '$' + Number(resp.realizedPnl).toFixed(2) : '$0.00';
        this.positionActionMsg.set({
          type: 'success',
          text: `Position #${pos.id} (${pos.symbol} ${pos.side}) closed. Realized P&L: ${pnlStr}`
        });
        this.loadPortfolio();
      },
      error: (err) => {
        this.closingPositionId.set(null);
        this.positionActionMsg.set({
          type: 'error',
          text: err?.error?.message || `Failed to close position #${pos.id}`
        });
      }
    });
  }

  getTotalMarginUsed(): number {
    return this.openPositions().reduce((acc, p) => acc + (p.marginUsed || 0), 0);
  }

  getTotalFloatingPnl(): number {
    return this.openPositions().reduce((acc, p) => acc + (p.unrealizedPnl || 0), 0);
  }

  openManageBalanceModal(action: 'deposit' | 'reset' = 'deposit'): void {
    this.balanceActionTab.set(action);
    this.manageBalanceError.set(null);
    this.manageBalanceSuccess.set(null);
    this.showManageBalanceModal.set(true);
  }

  closeManageBalanceModal(): void {
    this.showManageBalanceModal.set(false);
    this.manageBalanceError.set(null);
    this.manageBalanceSuccess.set(null);
  }

  setDepositPreset(amount: number): void {
    this.depositAmount.set(amount);
  }

  setResetPreset(amount: number): void {
    this.resetTargetAmount.set(amount);
  }

  submitDeposit(): void {
    const amount = Number(this.depositAmount());
    if (!amount || amount <= 0) {
      this.manageBalanceError.set('Please enter a valid deposit amount greater than 0.');
      return;
    }

    this.isManagingBalance.set(true);
    this.manageBalanceError.set(null);
    this.manageBalanceSuccess.set(null);

    this.tradingService.depositCash(amount).subscribe({
      next: (wallet) => {
        this.isManagingBalance.set(false);
        this.manageBalanceSuccess.set(`Successfully added $${amount.toLocaleString()} in virtual cash!`);
        this.loadPortfolio();
        setTimeout(() => {
          this.closeManageBalanceModal();
        }, 1500);
      },
      error: (err) => {
        this.isManagingBalance.set(false);
        this.manageBalanceError.set(err?.error?.message || 'Failed to deposit virtual funds.');
      }
    });
  }

  submitReset(): void {
    const target = Number(this.resetTargetAmount());
    if (!target || target <= 0) {
      this.manageBalanceError.set('Please enter a valid target balance greater than 0.');
      return;
    }

    this.isManagingBalance.set(true);
    this.manageBalanceError.set(null);
    this.manageBalanceSuccess.set(null);

    this.tradingService.resetCashBalance(target).subscribe({
      next: (wallet) => {
        this.isManagingBalance.set(false);
        this.manageBalanceSuccess.set(`Successfully reset balance to $${target.toLocaleString()}!`);
        this.loadPortfolio();
        setTimeout(() => {
          this.closeManageBalanceModal();
        }, 1500);
      },
      error: (err) => {
        this.isManagingBalance.set(false);
        this.manageBalanceError.set(err?.error?.message || 'Failed to reset virtual cash balance.');
      }
    });
  }

  navigateToStock(symbol: string): void {
    if (!symbol) return;
    this.router.navigate(['/dashboard/stock', symbol]);
  }

  getCurrencySymbol(currency?: string): string {
    if (currency === 'INR') return '₹';
    if (currency === 'EUR') return '€';
    if (currency === 'GBP') return '£';
    return '$';
  }
}
