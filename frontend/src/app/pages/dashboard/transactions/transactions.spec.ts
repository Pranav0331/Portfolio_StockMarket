import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { TransactionsComponent } from './transactions';
import { TransactionService } from '../../../services/transaction.service';
import { TransactionPageResponse } from '../../../models/trading.model';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('TransactionsComponent', () => {
  let transactionService: TransactionService;
  let router: Router;

  const mockTxResponse: TransactionPageResponse = {
    content: [
      {
        transactionId: 101,
        orderId: 501,
        symbol: 'RELIANCE',
        companyName: 'Reliance Industries Ltd',
        exchange: 'NSE',
        currency: 'INR',
        type: 'BUY',
        status: 'EXECUTED',
        quantity: 10,
        executionPrice: 2950.0,
        totalAmount: 29500.0,
        fees: 0,
        executedAt: '2026-09-30T10:00:00Z'
      },
      {
        transactionId: 102,
        orderId: 502,
        symbol: 'AAPL',
        companyName: 'Apple Inc.',
        exchange: 'NASDAQ',
        currency: 'USD',
        type: 'SELL',
        status: 'EXECUTED',
        quantity: 5,
        executionPrice: 230.0,
        totalAmount: 1150.0,
        fees: 0,
        executedAt: '2026-09-30T14:30:00Z'
      }
    ],
    page: 0,
    size: 15,
    totalElements: 2,
    totalPages: 1,
    first: true,
    last: true
  };

  const mockEmptyResponse: TransactionPageResponse = {
    content: [],
    page: 0,
    size: 15,
    totalElements: 0,
    totalPages: 0,
    first: true,
    last: true
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TransactionsComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([])
      ]
    }).compileComponents();

    transactionService = TestBed.inject(TransactionService);
    router = TestBed.inject(Router);
  });

  it('should create TransactionsComponent and load history on init', () => {
    const getTxSpy = vi.spyOn(transactionService, 'getTransactions').mockReturnValue(of(mockTxResponse));

    const fixture = TestBed.createComponent(TransactionsComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component).toBeTruthy();
    expect(getTxSpy).toHaveBeenCalled();
    expect(component.transactions().length).toBe(2);
    expect(component.pageResponse()?.totalElements).toBe(2);
    expect(component.isLoading()).toBe(false);
    expect(component.error()).toBeNull();
  });

  it('should filter by transaction type (BUY / SELL / ALL)', () => {
    const getTxSpy = vi.spyOn(transactionService, 'getTransactions').mockReturnValue(of(mockTxResponse));

    const fixture = TestBed.createComponent(TransactionsComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.setTypeFilter('BUY');
    expect(component.selectedType()).toBe('BUY');
    expect(component.currentPage()).toBe(0);
    expect(getTxSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'BUY' }));

    component.setTypeFilter('SELL');
    expect(component.selectedType()).toBe('SELL');
    expect(getTxSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'SELL' }));

    component.setTypeFilter('ALL');
    expect(component.selectedType()).toBe('ALL');
  });

  it('should filter by symbol and clear symbol filter', () => {
    vi.useFakeTimers();
    const getTxSpy = vi.spyOn(transactionService, 'getTransactions').mockReturnValue(of(mockTxResponse));

    const fixture = TestBed.createComponent(TransactionsComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    const mockEvent = { target: { value: 'AAPL' } } as any;
    component.onSymbolInput(mockEvent);
    expect(component.symbolSearch()).toBe('AAPL');

    vi.advanceTimersByTime(350);
    expect(getTxSpy).toHaveBeenCalledWith(expect.objectContaining({ symbol: 'AAPL' }));

    component.clearSymbolSearch();
    expect(component.symbolSearch()).toBe('');
    expect(getTxSpy).toHaveBeenCalledWith(expect.objectContaining({ symbol: undefined }));

    vi.useRealTimers();
  });

  it('should filter by date range and sorting', () => {
    const getTxSpy = vi.spyOn(transactionService, 'getTransactions').mockReturnValue(of(mockTxResponse));

    const fixture = TestBed.createComponent(TransactionsComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.onStartDateChange({ target: { value: '2026-09-01' } } as any);
    expect(component.startDate()).toBe('2026-09-01');
    expect(getTxSpy).toHaveBeenCalledWith(expect.objectContaining({ startDate: '2026-09-01' }));

    component.onEndDateChange({ target: { value: '2026-09-30' } } as any);
    expect(component.endDate()).toBe('2026-09-30');
    expect(getTxSpy).toHaveBeenCalledWith(expect.objectContaining({ endDate: '2026-09-30' }));

    component.onSortChange({ target: { value: 'asc' } } as any);
    expect(component.sortDirection()).toBe('asc');
    expect(getTxSpy).toHaveBeenCalledWith(expect.objectContaining({ sort: 'asc' }));
  });

  it('should reset all filters on resetFilters call', () => {
    vi.spyOn(transactionService, 'getTransactions').mockReturnValue(of(mockTxResponse));

    const fixture = TestBed.createComponent(TransactionsComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.selectedType.set('SELL');
    component.symbolSearch.set('AAPL');
    component.startDate.set('2026-09-01');
    component.endDate.set('2026-09-30');
    component.sortDirection.set('asc');
    component.currentPage.set(2);

    expect(component.hasActiveFilters()).toBe(true);

    component.resetFilters();

    expect(component.selectedType()).toBe('ALL');
    expect(component.symbolSearch()).toBe('');
    expect(component.startDate()).toBe('');
    expect(component.endDate()).toBe('');
    expect(component.sortDirection()).toBe('desc');
    expect(component.currentPage()).toBe(0);
    expect(component.hasActiveFilters()).toBe(false);
  });

  it('should navigate to page on pagination control', () => {
    const multiPageResponse: TransactionPageResponse = {
      ...mockTxResponse,
      page: 0,
      totalPages: 3,
      totalElements: 45
    };

    const getTxSpy = vi.spyOn(transactionService, 'getTransactions').mockReturnValue(of(multiPageResponse));

    const fixture = TestBed.createComponent(TransactionsComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.goToPage(1);
    expect(component.currentPage()).toBe(1);
    expect(getTxSpy).toHaveBeenCalledWith(expect.objectContaining({ page: 1 }));
  });

  it('should navigate to stock details when clicking a transaction row', () => {
    vi.spyOn(transactionService, 'getTransactions').mockReturnValue(of(mockTxResponse));
    const navigateSpy = vi.spyOn(router, 'navigate');

    const fixture = TestBed.createComponent(TransactionsComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.navigateToStock('RELIANCE');
    expect(navigateSpy).toHaveBeenCalledWith(['/dashboard/stock', 'RELIANCE']);
  });

  it('should handle empty state when 0 transactions exist', () => {
    vi.spyOn(transactionService, 'getTransactions').mockReturnValue(of(mockEmptyResponse));

    const fixture = TestBed.createComponent(TransactionsComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.transactions().length).toBe(0);
    expect(component.pageResponse()?.totalElements).toBe(0);
  });

  it('should handle error when loading fails and allow retry', () => {
    const getTxSpy = vi.spyOn(transactionService, 'getTransactions')
      .mockReturnValueOnce(throwError(() => ({ error: { message: 'Database connection failed' } })))
      .mockReturnValueOnce(of(mockTxResponse));

    const fixture = TestBed.createComponent(TransactionsComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.error()).toBe('Database connection failed');
    expect(component.isLoading()).toBe(false);

    component.refreshTransactions();
    expect(getTxSpy).toHaveBeenCalledTimes(2);
    expect(component.error()).toBeNull();
    expect(component.transactions().length).toBe(2);
  });

  it('should correctly format transaction outflow signs and badge classes', () => {
    const fixture = TestBed.createComponent(TransactionsComponent);
    const component = fixture.componentInstance;

    expect(component.isAmountOutflow('BUY')).toBe(true);
    expect(component.isAmountOutflow('WITHDRAWAL')).toBe(true);
    expect(component.isAmountOutflow('SELL')).toBe(false);
    expect(component.isAmountOutflow('DEPOSIT')).toBe(false);

    expect(component.getTransactionBadgeClass('BUY')).toBe('badge-buy');
    expect(component.getTransactionBadgeClass('SELL')).toBe('badge-sell');
    expect(component.getTransactionBadgeClass('DEPOSIT')).toBe('badge-deposit');
    expect(component.getTransactionBadgeClass('WITHDRAWAL')).toBe('badge-withdrawal');
  });

  it('should guard navigateToStock against cash transactions and UNKNOWN symbols', () => {
    const navigateSpy = vi.spyOn(router, 'navigate');
    const fixture = TestBed.createComponent(TransactionsComponent);
    const component = fixture.componentInstance;

    expect(component.isTradeableStock('AAPL')).toBe(true);
    expect(component.isTradeableStock('WITHDRAWAL')).toBe(false);
    expect(component.isTradeableStock('DEPOSIT')).toBe(false);
    expect(component.isTradeableStock('UNKNOWN')).toBe(false);

    component.navigateToStock('WITHDRAWAL');
    component.navigateToStock('UNKNOWN');
    expect(navigateSpy).not.toHaveBeenCalled();

    component.navigateToStock('AAPL');
    expect(navigateSpy).toHaveBeenCalledWith(['/dashboard/stock', 'AAPL']);
  });

  it('should render WITHDRAWAL transaction with negative sign, cost-outflow, and no Trade link', () => {
    const withdrawalTxResponse: TransactionPageResponse = {
      content: [
        {
          transactionId: 201,
          symbol: 'WITHDRAWAL',
          companyName: 'Cash Withdrawal',
          exchange: 'CASH',
          currency: 'USD',
          type: 'WITHDRAWAL',
          status: 'EXECUTED',
          quantity: 1,
          executionPrice: 99000.0,
          totalAmount: 99000.0,
          fees: 0,
          executedAt: '2026-10-13T10:00:00Z'
        }
      ],
      page: 0,
      size: 15,
      totalElements: 1,
      totalPages: 1,
      first: true,
      last: true
    };

    vi.spyOn(transactionService, 'getTransactions').mockReturnValue(of(withdrawalTxResponse));

    const fixture = TestBed.createComponent(TransactionsComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const amountSpan = compiled.querySelector('.total-amount');
    expect(amountSpan).not.toBeNull();
    expect(amountSpan?.textContent).toContain('-$99,000.00');
    expect(amountSpan?.classList.contains('cost-outflow')).toBe(true);
    expect(amountSpan?.classList.contains('cost-inflow')).toBe(false);

    const typeBadge = compiled.querySelector('.type-badge');
    expect(typeBadge?.classList.contains('badge-withdrawal')).toBe(true);

    const tradeLink = compiled.querySelector('.btn-stock-link');
    expect(tradeLink).toBeNull(); // No trade link for cash transaction
  });

  it('should request financialOnly: true to separate account ledger from trade history', () => {
    const getTxSpy = vi.spyOn(transactionService, 'getTransactions').mockReturnValue(of(mockTxResponse));

    const fixture = TestBed.createComponent(TransactionsComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(getTxSpy).toHaveBeenCalledWith(expect.objectContaining({
      financialOnly: true
    }));
  });

  it('should compute cash flow impact classes, signs, and explanations correctly', () => {
    const fixture = TestBed.createComponent(TransactionsComponent);
    const component = fixture.componentInstance;

    const depositTx: any = { type: 'DEPOSIT', totalAmount: 10000 };
    expect(component.getCashFlowImpactClass(depositTx)).toBe('impact-credit');
    expect(component.getCashFlowSign(depositTx)).toBe('+');
    expect(component.getCashFlowImpactExplanation(depositTx)).toContain('Increases Cash');

    const withdrawTx: any = { type: 'WITHDRAWAL', totalAmount: 5000 };
    expect(component.getCashFlowImpactClass(withdrawTx)).toBe('impact-debit');
    expect(component.getCashFlowSign(withdrawTx)).toBe('-');
    expect(component.getCashFlowImpactExplanation(withdrawTx)).toContain('Decreases Cash');

    const resetTx: any = { type: 'ACCOUNT_RESET', totalAmount: 100000 };
    expect(component.getCashFlowImpactClass(resetTx)).toBe('impact-reset');
    expect(component.getCashFlowSign(resetTx)).toBe('=');
    expect(component.getCashFlowImpactExplanation(resetTx)).toContain('Replaces Cash Balance');

    const initTx: any = { type: 'ACCOUNT_INIT', totalAmount: 100000 };
    expect(component.getCashFlowImpactClass(initTx)).toBe('impact-credit');
    expect(component.getCashFlowSign(initTx)).toBe('+');
    expect(component.getCashFlowImpactExplanation(initTx)).toContain('Increases Cash');
  });

  it('should display Historical record unavailable when initial funding was not persisted', () => {
    vi.spyOn(transactionService, 'getTransactions').mockReturnValue(of(mockEmptyResponse));
    vi.spyOn(transactionService, 'getAccountSummary').mockReturnValue(of({
      initialFundingAmount: null,
      initialFundingRecorded: false,
      initialFundingTime: null,
      totalDeposited: 0,
      totalWithdrawn: 0,
      currentCashBalance: 98813.0,
      totalRealizedPnl: 0,
      totalUnrealizedPnl: -14.2,
      overallTradingPnl: -14.2,
      accountEquity: 99985.8,
      marginUsed: 0,
      spotHoldingsMarketValue: 1172.8,
      totalTradesCount: 15,
      openPositionsCount: 2
    }));

    const fixture = TestBed.createComponent(TransactionsComponent);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const unavailableSpan = compiled.querySelector('.text-unavailable');
    expect(unavailableSpan).not.toBeNull();
    expect(unavailableSpan?.textContent).toContain('Historical record unavailable');

    const unavailPill = compiled.querySelector('.pill-unavailable');
    expect(unavailPill).not.toBeNull();
    expect(unavailPill?.textContent).toContain('Unavailable');
  });

  describe('Light Mode and Dark Mode theme consistency', () => {
    afterEach(() => {
      document.documentElement.removeAttribute('data-theme');
    });

    it('should properly render all ledger sections in Light Mode', () => {
      document.documentElement.setAttribute('data-theme', 'light');
      vi.spyOn(transactionService, 'getTransactions').mockReturnValue(of(mockTxResponse));
      vi.spyOn(transactionService, 'getAccountSummary').mockReturnValue(of({
        initialFundingAmount: 100000,
        initialFundingRecorded: true,
        initialFundingTime: '2026-01-01T00:00:00Z',
        totalDeposited: 15000,
        totalWithdrawn: 5000,
        currentCashBalance: 110000,
        totalRealizedPnl: 1200,
        totalUnrealizedPnl: 450,
        overallTradingPnl: 1650,
        accountEquity: 111650,
        marginUsed: 0,
        spotHoldingsMarketValue: 0,
        totalTradesCount: 10,
        openPositionsCount: 1
      }));

      const fixture = TestBed.createComponent(TransactionsComponent);
      fixture.detectChanges();
      const compiled = fixture.nativeElement as HTMLElement;

      // 1. Page Header & Badges
      expect(compiled.querySelector('.page-title')).not.toBeNull();
      expect(compiled.querySelector('.count-badge')).not.toBeNull();
      expect(compiled.querySelector('.btn-refresh')).not.toBeNull();

      // 2. Trades Separation Notice Banner
      expect(compiled.querySelector('.trades-banner-chip')).not.toBeNull();
      expect(compiled.querySelector('.btn-goto-orders')).not.toBeNull();

      // 3. Account Summary & Overview
      expect(compiled.querySelector('.account-summary-section')).not.toBeNull();
      expect(compiled.querySelector('.equity-hero-chip')).not.toBeNull();
      expect(compiled.querySelector('.summary-grid')).not.toBeNull();
      const summaryCards = compiled.querySelectorAll('.summary-card');
      expect(summaryCards.length).toBe(5);
      expect(compiled.querySelector('.pill-withdrawal')).toBeNull();

      // 4. Financial Filters Toolbar (All, Initial, Deposits, Reset, Adjustments)
      expect(compiled.querySelector('.filters-card')).not.toBeNull();
      expect(compiled.querySelectorAll('.pill-btn').length).toBe(5);
      expect(compiled.querySelector('.search-input')).not.toBeNull();
      expect(compiled.querySelector('.date-inputs')).not.toBeNull();
      expect(compiled.querySelector('.filter-select')).not.toBeNull();

      // 5. Table & Transactions Rows
      expect(compiled.querySelector('.table-container')).not.toBeNull();
      expect(compiled.querySelectorAll('.transactions-table th').length).toBe(8);
      expect(compiled.querySelectorAll('.tx-row').length).toBe(2);

      // 6. Badges & Cash Flow pills
      expect(compiled.querySelector('.flow-pill')).not.toBeNull();
      expect(compiled.querySelector('.type-badge')).not.toBeNull();
      expect(compiled.querySelector('.status-badge')).not.toBeNull();
    });

    it('should render empty state appropriately when no transactions exist in Light Mode', () => {
      document.documentElement.setAttribute('data-theme', 'light');
      vi.spyOn(transactionService, 'getTransactions').mockReturnValue(of(mockEmptyResponse));
      vi.spyOn(transactionService, 'getAccountSummary').mockReturnValue(of(null as any));

      const fixture = TestBed.createComponent(TransactionsComponent);
      fixture.detectChanges();
      const compiled = fixture.nativeElement as HTMLElement;

      const emptyState = compiled.querySelector('.empty-state');
      expect(emptyState).not.toBeNull();
      expect(compiled.querySelector('.empty-title')).not.toBeNull();
      expect(compiled.querySelector('.empty-desc')).not.toBeNull();
      expect(compiled.querySelector('.empty-icon-box')).not.toBeNull();
    });

    it('should switch between Dark and Light Mode dynamically without error', () => {
      vi.spyOn(transactionService, 'getTransactions').mockReturnValue(of(mockTxResponse));
      const fixture = TestBed.createComponent(TransactionsComponent);
      fixture.detectChanges();

      // Dark mode active
      document.documentElement.setAttribute('data-theme', 'dark');
      fixture.detectChanges();
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

      // Switch to Light mode
      document.documentElement.setAttribute('data-theme', 'light');
      fixture.detectChanges();
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');

      // Verify DOM is intact
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('.page-title')?.textContent).toContain('Paper Trading Account Ledger');
      expect(compiled.querySelector('.transactions-table')).not.toBeNull();
    });
  });
});

