package com.portfolio.service;

import com.portfolio.dto.common.PageResponseDto;
import com.portfolio.dto.order.OrderDto;
import com.portfolio.dto.trading.VirtualWalletDto;
import com.portfolio.dto.transaction.AccountSummaryDto;
import com.portfolio.dto.transaction.TransactionDto;
import com.portfolio.entity.Order;
import com.portfolio.entity.Stock;
import com.portfolio.entity.Transaction;
import com.portfolio.entity.User;
import com.portfolio.entity.enums.OrderStatus;
import com.portfolio.entity.enums.OrderType;
import com.portfolio.entity.enums.TradingMode;
import com.portfolio.entity.enums.TransactionStatus;
import com.portfolio.entity.enums.TransactionType;
import com.portfolio.repository.OrderRepository;
import com.portfolio.repository.TransactionRepository;
import com.portfolio.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PaperTradingLedgerAndAccountSummaryTest {

    @Mock
    private TransactionRepository transactionRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private TradingService tradingService;

    @Mock
    private OrderRepository orderRepository;

    @InjectMocks
    private TransactionService transactionService;

    private User testUser;
    private Stock stockApple;

    @BeforeEach
    void setUp() {
        testUser = new User();
        testUser.setId(42L);
        testUser.setEmail("trader42@portfolio.com");
        testUser.setFullName("Ledger Test User");
        testUser.setVirtualBalance(new BigDecimal("100000.0000"));

        stockApple = new Stock("AAPL", "Apple Inc.", "NASDAQ", "USD");
        stockApple.setId(101L);
    }

    @Test
    @DisplayName("1. Account creation records genuine ACCOUNT_INIT with initial balance")
    void testAccountCreationWithInitialFunding() {
        Transaction initTx = new Transaction();
        initTx.setId(1L);
        initTx.setUser(testUser);
        initTx.setTransactionType(TransactionType.ACCOUNT_INIT);
        initTx.setStatus(TransactionStatus.SUCCESS);
        initTx.setTotalAmount(new BigDecimal("100000.00"));
        initTx.setCreatedAt(Instant.parse("2026-10-01T12:00:00Z"));

        when(userRepository.findById(42L)).thenReturn(Optional.of(testUser));
        when(transactionRepository.findByUserIdOrderByCreatedAtAscIdAsc(42L)).thenReturn(List.of(initTx));

        VirtualWalletDto mockWallet = new VirtualWalletDto(
                new BigDecimal("100000.00"),
                BigDecimal.ZERO,
                new BigDecimal("100000.00"),
                "USD"
        );
        when(tradingService.getWallet(42L)).thenReturn(mockWallet);
        when(tradingService.getUserHoldings(42L)).thenReturn(List.of());
        when(tradingService.getUserPositions(42L, null, com.portfolio.entity.enums.PositionStatus.OPEN)).thenReturn(List.of());

        AccountSummaryDto summary = transactionService.getAccountSummary(42L);

        assertThat(summary).isNotNull();
        assertThat(summary.initialFundingRecorded()).isTrue();
        assertThat(summary.initialFundingAmount()).isEqualByComparingTo("100000.00");
        assertThat(summary.initialFundingTime()).isEqualTo(Instant.parse("2026-10-01T12:00:00Z"));
        assertThat(summary.currentCashBalance()).isEqualByComparingTo("100000.00");
        assertThat(summary.accountEquity()).isEqualByComparingTo("100000.00");
        assertThat(summary.totalDeposited()).isEqualByComparingTo("0.00");
        assertThat(summary.totalWithdrawn()).isEqualByComparingTo("0.00");
    }

    @Test
    @DisplayName("2. Legacy accounts without explicit initial funding record show as unavailable rather than fabricating")
    void testLegacyAccountInitialFundingUnavailable() {
        when(userRepository.findById(42L)).thenReturn(Optional.of(testUser));
        when(transactionRepository.findByUserIdOrderByCreatedAtAscIdAsc(42L)).thenReturn(List.of());

        VirtualWalletDto mockWallet = new VirtualWalletDto(
                new BigDecimal("95000.00"),
                new BigDecimal("5000.00"),
                new BigDecimal("100000.00"),
                "USD"
        );
        when(tradingService.getWallet(42L)).thenReturn(mockWallet);
        when(tradingService.getUserHoldings(42L)).thenReturn(List.of());
        when(tradingService.getUserPositions(42L, null, com.portfolio.entity.enums.PositionStatus.OPEN)).thenReturn(List.of());

        AccountSummaryDto summary = transactionService.getAccountSummary(42L);

        assertThat(summary).isNotNull();
        assertThat(summary.initialFundingRecorded()).isFalse();
        assertThat(summary.initialFundingAmount()).isNull();
        assertThat(summary.initialFundingTime()).isNull();
        assertThat(summary.currentCashBalance()).isEqualByComparingTo("95000.00");
    }

    @Test
    @DisplayName("3. Total deposits and withdrawals are accurately aggregated")
    void testDepositsAndWithdrawalsAggregation() {
        Transaction deposit1 = new Transaction();
        deposit1.setId(10L);
        deposit1.setUser(testUser);
        deposit1.setTransactionType(TransactionType.DEPOSIT);
        deposit1.setStatus(TransactionStatus.SUCCESS);
        deposit1.setTotalAmount(new BigDecimal("5000.00"));
        deposit1.setCreatedAt(Instant.parse("2026-10-02T10:00:00Z"));

        Transaction deposit2 = new Transaction();
        deposit2.setId(11L);
        deposit2.setUser(testUser);
        deposit2.setTransactionType(TransactionType.DEPOSIT);
        deposit2.setStatus(TransactionStatus.SUCCESS);
        deposit2.setTotalAmount(new BigDecimal("15000.00"));
        deposit2.setCreatedAt(Instant.parse("2026-10-03T10:00:00Z"));

        Transaction withdrawal = new Transaction();
        withdrawal.setId(12L);
        withdrawal.setUser(testUser);
        withdrawal.setTransactionType(TransactionType.WITHDRAWAL);
        withdrawal.setStatus(TransactionStatus.SUCCESS);
        withdrawal.setTotalAmount(new BigDecimal("3000.00"));
        withdrawal.setCreatedAt(Instant.parse("2026-10-04T10:00:00Z"));

        when(userRepository.findById(42L)).thenReturn(Optional.of(testUser));
        when(transactionRepository.findByUserIdOrderByCreatedAtAscIdAsc(42L)).thenReturn(List.of(deposit1, deposit2, withdrawal));

        VirtualWalletDto mockWallet = new VirtualWalletDto(
                new BigDecimal("117000.00"),
                BigDecimal.ZERO,
                new BigDecimal("117000.00"),
                "USD"
        );
        when(tradingService.getWallet(42L)).thenReturn(mockWallet);
        when(tradingService.getUserHoldings(42L)).thenReturn(List.of());
        when(tradingService.getUserPositions(42L, null, com.portfolio.entity.enums.PositionStatus.OPEN)).thenReturn(List.of());

        AccountSummaryDto summary = transactionService.getAccountSummary(42L);

        assertThat(summary.totalDeposited()).isEqualByComparingTo("20000.00");
        assertThat(summary.totalWithdrawn()).isEqualByComparingTo("3000.00");
        assertThat(summary.currentCashBalance()).isEqualByComparingTo("117000.00");
    }

    @Test
    @DisplayName("4. Realized and unrealized P&L are correctly separated and account equity does not double count")
    void testRealizedAndUnrealizedPnlAccounting() {
        Transaction trade1 = new Transaction();
        trade1.setId(21L);
        trade1.setUser(testUser);
        trade1.setStock(stockApple);
        trade1.setTransactionType(TransactionType.SELL);
        trade1.setStatus(TransactionStatus.SUCCESS);
        trade1.setTotalAmount(new BigDecimal("12000.00"));
        trade1.setPnl(new BigDecimal("2000.00")); // Realized profit
        trade1.setCreatedAt(Instant.parse("2026-10-05T10:00:00Z"));

        when(userRepository.findById(42L)).thenReturn(Optional.of(testUser));
        when(transactionRepository.findByUserIdOrderByCreatedAtAscIdAsc(42L)).thenReturn(List.of(trade1));

        VirtualWalletDto mockWallet = new VirtualWalletDto(
                new BigDecimal("102000.00"), // cash balance (starts 100k + 2k realized)
                new BigDecimal("10000.00"), // margin used
                new BigDecimal("103500.00"), // equity: cash (102k) + floating margin pnl (1.5k)
                "USD",
                new BigDecimal("10000.00"),
                new BigDecimal("1500.00"),   // floating unrealized PnL
                new BigDecimal("92000.00"),
                new BigDecimal("1035.00")
        );
        when(tradingService.getWallet(42L)).thenReturn(mockWallet);
        when(tradingService.getUserHoldings(42L)).thenReturn(List.of());
        when(tradingService.getUserPositions(42L, null, com.portfolio.entity.enums.PositionStatus.OPEN)).thenReturn(List.of());

        AccountSummaryDto summary = transactionService.getAccountSummary(42L);

        assertThat(summary.totalRealizedPnl()).isEqualByComparingTo("2000.00");
        assertThat(summary.totalUnrealizedPnl()).isEqualByComparingTo("1500.00");
        assertThat(summary.overallTradingPnl()).isEqualByComparingTo("3500.00"); // 2000 + 1500
        assertThat(summary.accountEquity()).isEqualByComparingTo("103500.00");
    }

    @Test
    @DisplayName("5. Chronological ledger computes exact balanceAfterEvent and descriptive strings for each event")
    void testChronologicalLedgerRunningBalancesAndDescriptions() {
        Transaction initTx = new Transaction();
        initTx.setId(101L);
        initTx.setUser(testUser);
        initTx.setTransactionType(TransactionType.ACCOUNT_INIT);
        initTx.setStatus(TransactionStatus.SUCCESS);
        initTx.setTotalAmount(new BigDecimal("100000.00"));
        initTx.setCreatedAt(Instant.parse("2026-10-01T10:00:00Z"));

        Transaction buyTx = new Transaction();
        buyTx.setId(102L);
        buyTx.setUser(testUser);
        buyTx.setStock(stockApple);
        buyTx.setTransactionType(TransactionType.BUY);
        buyTx.setStatus(TransactionStatus.SUCCESS);
        buyTx.setQuantity(new BigDecimal("10"));
        buyTx.setPricePerUnit(new BigDecimal("150.00"));
        buyTx.setTotalAmount(new BigDecimal("1500.00"));
        buyTx.setCreatedAt(Instant.parse("2026-10-02T10:00:00Z"));

        Transaction sellTx = new Transaction();
        sellTx.setId(103L);
        sellTx.setUser(testUser);
        sellTx.setStock(stockApple);
        sellTx.setTransactionType(TransactionType.SELL);
        sellTx.setStatus(TransactionStatus.SUCCESS);
        sellTx.setQuantity(new BigDecimal("10"));
        sellTx.setPricePerUnit(new BigDecimal("165.00"));
        sellTx.setTotalAmount(new BigDecimal("1650.00"));
        sellTx.setPnl(new BigDecimal("150.00"));
        sellTx.setCreatedAt(Instant.parse("2026-10-03T10:00:00Z"));

        Transaction depositTx = new Transaction();
        depositTx.setId(104L);
        depositTx.setUser(testUser);
        depositTx.setTransactionType(TransactionType.DEPOSIT);
        depositTx.setStatus(TransactionStatus.SUCCESS);
        depositTx.setTotalAmount(new BigDecimal("5000.00"));
        depositTx.setCreatedAt(Instant.parse("2026-10-04T10:00:00Z"));

        when(userRepository.findById(42L)).thenReturn(Optional.of(testUser));
        when(transactionRepository.findByUserIdOrderByCreatedAtAscIdAsc(42L))
                .thenReturn(List.of(initTx, buyTx, sellTx, depositTx));

        when(transactionRepository.findUserTransactions(
                eq(42L), any(), any(), any(), any(), any(), any(Pageable.class)
        )).thenReturn(new PageImpl<>(List.of(initTx, buyTx, sellTx, depositTx)));

        PageResponseDto<TransactionDto> result = transactionService.getUserTransactions(
                42L, "ALL", null, null, null, null, 0, 15, "asc"
        );

        List<TransactionDto> content = result.content();
        assertThat(content).hasSize(4);

        // 1. Initial funding: balance = 100,000.00
        TransactionDto d1 = content.get(0);
        assertThat(d1.type()).isEqualTo("ACCOUNT_INIT");
        assertThat(d1.balanceAfterEvent()).isEqualByComparingTo("100000.00");
        assertThat(d1.description()).contains("Initial virtual cash credited");

        // 2. Buy 10 AAPL @ 150 = 1,500.00 out: balance = 98,500.00
        TransactionDto d2 = content.get(1);
        assertThat(d2.type()).isEqualTo("BUY");
        assertThat(d2.balanceAfterEvent()).isEqualByComparingTo("98500.00");
        assertThat(d2.description()).contains("Bought 10 AAPL");

        // 3. Sell 10 AAPL @ 165 = 1,650.00 in: balance = 100,150.00
        TransactionDto d3 = content.get(2);
        assertThat(d3.type()).isEqualTo("SELL");
        assertThat(d3.balanceAfterEvent()).isEqualByComparingTo("100150.00");
        assertThat(d3.description()).contains("Sold 10 AAPL");

        // 4. Deposit 5,000.00: balance = 105,150.00
        TransactionDto d4 = content.get(3);
        assertThat(d4.type()).isEqualTo("DEPOSIT");
        assertThat(d4.balanceAfterEvent()).isEqualByComparingTo("105150.00");
        assertThat(d4.description()).contains("Virtual cash deposit");
    }

    @Test
    @DisplayName("6. ACCOUNT_RESET resets the ledger running balance and preserves prior history")
    void testAccountResetPreservesHistoryAndResetsBalance() {
        Transaction depositTx = new Transaction();
        depositTx.setId(201L);
        depositTx.setUser(testUser);
        depositTx.setTransactionType(TransactionType.DEPOSIT);
        depositTx.setStatus(TransactionStatus.SUCCESS);
        depositTx.setTotalAmount(new BigDecimal("10000.00"));
        depositTx.setCreatedAt(Instant.parse("2026-10-01T10:00:00Z"));

        Transaction resetTx = new Transaction();
        resetTx.setId(202L);
        resetTx.setUser(testUser);
        resetTx.setTransactionType(TransactionType.ACCOUNT_RESET);
        resetTx.setStatus(TransactionStatus.SUCCESS);
        resetTx.setTotalAmount(new BigDecimal("50000.00"));
        resetTx.setCreatedAt(Instant.parse("2026-10-02T10:00:00Z"));

        Transaction postResetBuy = new Transaction();
        postResetBuy.setId(203L);
        postResetBuy.setUser(testUser);
        postResetBuy.setStock(stockApple);
        postResetBuy.setTransactionType(TransactionType.BUY);
        postResetBuy.setStatus(TransactionStatus.SUCCESS);
        postResetBuy.setQuantity(new BigDecimal("10"));
        postResetBuy.setPricePerUnit(new BigDecimal("100.00"));
        postResetBuy.setTotalAmount(new BigDecimal("1000.00"));
        postResetBuy.setCreatedAt(Instant.parse("2026-10-03T10:00:00Z"));

        when(userRepository.findById(42L)).thenReturn(Optional.of(testUser));
        when(transactionRepository.findByUserIdOrderByCreatedAtAscIdAsc(42L))
                .thenReturn(List.of(depositTx, resetTx, postResetBuy));

        when(transactionRepository.findUserTransactions(
                eq(42L), any(), any(), any(), any(), any(), any(Pageable.class)
        )).thenReturn(new PageImpl<>(List.of(depositTx, resetTx, postResetBuy)));

        PageResponseDto<TransactionDto> result = transactionService.getUserTransactions(
                42L, "ALL", null, null, null, null, 0, 15, "asc"
        );

        List<TransactionDto> content = result.content();
        assertThat(content).hasSize(3);

        // Before reset: deposit increases baseline (100k + 10k = 110,000)
        assertThat(content.get(0).balanceAfterEvent()).isEqualByComparingTo("110000.00");

        // At reset: balance resets to target 50,000.00
        assertThat(content.get(1).type()).isEqualTo("ACCOUNT_RESET");
        assertThat(content.get(1).balanceAfterEvent()).isEqualByComparingTo("50000.00");
        assertThat(content.get(1).description()).contains("Paper trading account balance reset");

        // After reset: buy decreases balance from 50,000 to 49,000
        assertThat(content.get(2).balanceAfterEvent()).isEqualByComparingTo("49000.00");
    }

    @Test
    @DisplayName("7. Orders service separation: Orders only returns genuine trade orders, never funding or resets")
    void testOrdersServiceSeparation() {
        OrderService orderService = new OrderService(orderRepository);

        Order buyOrder = new Order(testUser, stockApple, OrderType.BUY, new BigDecimal("10"), new BigDecimal("150.00"));
        buyOrder.setId(901L);
        buyOrder.setOrderStatus(OrderStatus.EXECUTED);
        buyOrder.setCreatedAt(Instant.now());

        when(orderRepository.findUserOrders(eq(42L), any(), any(), any(), any(), any(), any(), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(buyOrder)));

        PageResponseDto<OrderDto> orderPage = orderService.getUserOrders(42L, "BUY", "EXECUTED", null, null, null, null, 0, 15, "desc");

        assertThat(orderPage.content()).hasSize(1);
        OrderDto dto = orderPage.content().get(0);
        assertThat(dto.symbol()).isEqualTo("AAPL");
        assertThat(dto.orderType()).isEqualTo("BUY");
        assertThat(dto.orderStatus()).isEqualTo("EXECUTED");
    }

    @Test
    @DisplayName("8. Financial ledger separation: financialOnly=true separates financial events from trades and attaches cash flow impact")
    void testFinancialOnlySeparatesLedgerFromTradeExecutions() {
        Transaction initTx = new Transaction();
        initTx.setId(301L);
        initTx.setUser(testUser);
        initTx.setTransactionType(TransactionType.ACCOUNT_INIT);
        initTx.setStatus(TransactionStatus.SUCCESS);
        initTx.setTotalAmount(new BigDecimal("100000.00"));
        initTx.setCreatedAt(Instant.parse("2026-10-01T08:00:00Z"));

        Transaction depositTx = new Transaction();
        depositTx.setId(302L);
        depositTx.setUser(testUser);
        depositTx.setTransactionType(TransactionType.DEPOSIT);
        depositTx.setStatus(TransactionStatus.SUCCESS);
        depositTx.setTotalAmount(new BigDecimal("25000.00"));
        depositTx.setCreatedAt(Instant.parse("2026-10-02T08:00:00Z"));

        Transaction withdrawalTx = new Transaction();
        withdrawalTx.setId(303L);
        withdrawalTx.setUser(testUser);
        withdrawalTx.setTransactionType(TransactionType.WITHDRAWAL);
        withdrawalTx.setStatus(TransactionStatus.SUCCESS);
        withdrawalTx.setTotalAmount(new BigDecimal("5000.00"));
        withdrawalTx.setCreatedAt(Instant.parse("2026-10-03T08:00:00Z"));

        Transaction resetTx = new Transaction();
        resetTx.setId(304L);
        resetTx.setUser(testUser);
        resetTx.setTransactionType(TransactionType.ACCOUNT_RESET);
        resetTx.setStatus(TransactionStatus.SUCCESS);
        resetTx.setTotalAmount(new BigDecimal("100000.00"));
        resetTx.setCreatedAt(Instant.parse("2026-10-04T08:00:00Z"));

        when(userRepository.findById(42L)).thenReturn(Optional.of(testUser));
        when(transactionRepository.findByUserIdOrderByCreatedAtAscIdAsc(42L))
                .thenReturn(List.of(initTx, depositTx, withdrawalTx, resetTx));

        when(transactionRepository.findUserTransactions(
                eq(42L), eq(true), any(), any(), any(), any(), any(), any(Pageable.class)
        )).thenReturn(new PageImpl<>(List.of(initTx, depositTx, withdrawalTx, resetTx)));

        PageResponseDto<TransactionDto> result = transactionService.getUserTransactions(
                42L, true, "ALL", null, null, null, null, 0, 15, "desc"
        );

        assertThat(result.content()).hasSize(4);

        TransactionDto dInit = result.content().get(0);
        assertThat(dInit.type()).isEqualTo("ACCOUNT_INIT");
        assertThat(dInit.cashFlowImpact()).isEqualTo("CREDIT");
        assertThat(dInit.cashFlowImpactLabel()).contains("Increases Cash");

        TransactionDto dDeposit = result.content().get(1);
        assertThat(dDeposit.type()).isEqualTo("DEPOSIT");
        assertThat(dDeposit.cashFlowImpact()).isEqualTo("CREDIT");
        assertThat(dDeposit.cashFlowImpactLabel()).contains("Increases Cash");

        TransactionDto dWithdrawal = result.content().get(2);
        assertThat(dWithdrawal.type()).isEqualTo("WITHDRAWAL");
        assertThat(dWithdrawal.cashFlowImpact()).isEqualTo("DEBIT");
        assertThat(dWithdrawal.cashFlowImpactLabel()).contains("Decreases Cash");

        TransactionDto dReset = result.content().get(3);
        assertThat(dReset.type()).isEqualTo("ACCOUNT_RESET");
        assertThat(dReset.cashFlowImpact()).isEqualTo("RESET");
        assertThat(dReset.cashFlowImpactLabel()).contains("Resets Cash Balance");
    }

    @Test
    @DisplayName("9. Reset Account Summary: Pre-reset trades and losses (-$33.80) are excluded from post-reset summary metrics")
    void testResetAccountCalculatesSummaryCleanlyWithoutOldTradesOrOldLosses() {
        // Pre-reset history
        Transaction initTx = new Transaction();
        initTx.setId(401L);
        initTx.setUser(testUser);
        initTx.setTransactionType(TransactionType.ACCOUNT_INIT);
        initTx.setStatus(TransactionStatus.SUCCESS);
        initTx.setTotalAmount(new BigDecimal("10000.00"));
        initTx.setCreatedAt(Instant.parse("2026-10-01T08:00:00Z"));

        Transaction oldTradeLoss = new Transaction();
        oldTradeLoss.setId(402L);
        oldTradeLoss.setUser(testUser);
        oldTradeLoss.setStock(stockApple);
        oldTradeLoss.setTransactionType(TransactionType.SELL);
        oldTradeLoss.setStatus(TransactionStatus.SUCCESS);
        oldTradeLoss.setPnl(new BigDecimal("-33.80"));
        oldTradeLoss.setTotalAmount(new BigDecimal("966.20"));
        oldTradeLoss.setCreatedAt(Instant.parse("2026-10-02T10:00:00Z"));

        // Account reset at 2026-10-03
        Transaction resetTx = new Transaction();
        resetTx.setId(403L);
        resetTx.setUser(testUser);
        resetTx.setTransactionType(TransactionType.ACCOUNT_RESET);
        resetTx.setStatus(TransactionStatus.SUCCESS);
        resetTx.setTotalAmount(new BigDecimal("10000.00"));
        resetTx.setCreatedAt(Instant.parse("2026-10-03T12:00:00Z"));

        when(userRepository.findById(42L)).thenReturn(Optional.of(testUser));
        when(transactionRepository.findByUserIdOrderByCreatedAtAscIdAsc(42L))
                .thenReturn(List.of(initTx, oldTradeLoss, resetTx));

        VirtualWalletDto postResetWallet = new VirtualWalletDto(
                new BigDecimal("10000.00"),
                BigDecimal.ZERO,
                new BigDecimal("10000.00"),
                "USD"
        );
        when(tradingService.getWallet(42L)).thenReturn(postResetWallet);
        when(tradingService.getUserHoldings(42L)).thenReturn(List.of());
        when(tradingService.getUserPositions(42L, null, com.portfolio.entity.enums.PositionStatus.OPEN)).thenReturn(List.of());

        AccountSummaryDto summary = transactionService.getAccountSummary(42L);

        assertThat(summary).isNotNull();
        // Initial funding reflects the post-reset starting balance ($10,000.00)
        assertThat(summary.initialFundingAmount()).isEqualByComparingTo("10000.00");
        assertThat(summary.currentCashBalance()).isEqualByComparingTo("10000.00");
        assertThat(summary.accountEquity()).isEqualByComparingTo("10000.00");
        // Old trade loss (-$33.80) is NOT counted after reset
        assertThat(summary.totalRealizedPnl()).isEqualByComparingTo("0.00");
        assertThat(summary.totalUnrealizedPnl()).isEqualByComparingTo("0.00");
        assertThat(summary.overallTradingPnl()).isEqualByComparingTo("0.00");
        assertThat(summary.totalTradesCount()).isEqualTo(0);
        assertThat(summary.openPositionsCount()).isEqualTo(0);
    }

    @Test
    @DisplayName("10. Recent Executions filtering: tradesOnly=true queries only BUY/SELL transactions")
    void testTradesOnlyFilterExcludesFinancialEvents() {
        when(transactionRepository.findUserTransactions(
                eq(42L), eq(false), eq(true), any(), any(), any(), any(), any(), any(Pageable.class)
        )).thenReturn(new PageImpl<>(List.of()));

        PageResponseDto<TransactionDto> result = transactionService.getUserTransactions(
                42L, false, true, "ALL", null, null, null, null, 0, 5, "desc"
        );

        assertThat(result.content()).isEmpty();
        verify(transactionRepository).findUserTransactions(
                eq(42L), eq(false), eq(true), any(), any(), any(), any(), any(), any(Pageable.class)
        );
    }
}
