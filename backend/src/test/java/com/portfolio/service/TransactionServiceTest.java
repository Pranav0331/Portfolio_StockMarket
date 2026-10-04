package com.portfolio.service;

import com.portfolio.dto.common.PageResponseDto;
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
import com.portfolio.repository.TransactionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TransactionServiceTest {

    @Mock
    private TransactionRepository transactionRepository;

    @InjectMocks
    private TransactionService transactionService;

    private User testUser;
    private Stock stockReliance;
    private Stock stockApple;
    private Order orderBuy;
    private Transaction txBuy;
    private Transaction txSell;

    @BeforeEach
    void setUp() {
        testUser = new User();
        testUser.setId(10L);
        testUser.setEmail("test@portfolio.com");
        testUser.setFullName("Test Trader");

        stockReliance = new Stock("RELIANCE", "Reliance Industries Ltd", "NSE", "INR");
        stockReliance.setId(100L);

        stockApple = new Stock("AAPL", "Apple Inc.", "NASDAQ", "USD");
        stockApple.setId(200L);

        orderBuy = new Order(testUser, stockReliance, OrderType.BUY, new BigDecimal("10"), new BigDecimal("2950.00"));
        orderBuy.setId(501L);
        orderBuy.setOrderStatus(OrderStatus.EXECUTED);
        orderBuy.setTradingMode(TradingMode.INTRADAY);
        orderBuy.setExecutedPrice(new BigDecimal("2950.00"));
        orderBuy.setExecutedAt(Instant.parse("2026-09-30T10:00:00Z"));

        txBuy = new Transaction(testUser, stockReliance, TransactionType.BUY, new BigDecimal("29500.00"));
        txBuy.setId(1001L);
        txBuy.setOrder(orderBuy);
        txBuy.setStatus(TransactionStatus.SUCCESS);
        txBuy.setTradingMode(TradingMode.INTRADAY);
        txBuy.setQuantity(new BigDecimal("10"));
        txBuy.setPricePerUnit(new BigDecimal("2950.00"));
        txBuy.setCreatedAt(Instant.parse("2026-09-30T10:00:00Z"));

        Order orderSell = new Order(testUser, stockApple, OrderType.SELL, new BigDecimal("5"), new BigDecimal("230.00"));
        orderSell.setId(502L);
        orderSell.setOrderStatus(OrderStatus.EXECUTED);
        orderSell.setTradingMode(TradingMode.SWING);
        orderSell.setExecutedPrice(new BigDecimal("230.00"));
        orderSell.setExecutedAt(Instant.parse("2026-09-30T14:30:00Z"));

        txSell = new Transaction(testUser, stockApple, TransactionType.SELL, new BigDecimal("1150.00"));
        txSell.setId(1002L);
        txSell.setOrder(orderSell);
        txSell.setStatus(TransactionStatus.SUCCESS);
        txSell.setTradingMode(TradingMode.SWING);
        txSell.setQuantity(new BigDecimal("5"));
        txSell.setPricePerUnit(new BigDecimal("230.00"));
        txSell.setCreatedAt(Instant.parse("2026-09-30T14:30:00Z"));
    }

    @Test
    @DisplayName("1. Fetch all user transactions with pagination and sorting")
    void testGetUserTransactionsAll() {
        when(transactionRepository.findUserTransactions(
                eq(10L), isNull(), isNull(), isNull(), isNull(), isNull(), any(Pageable.class)
        )).thenReturn(new PageImpl<>(List.of(txSell, txBuy)));

        PageResponseDto<TransactionDto> result = transactionService.getUserTransactions(
                10L, null, null, null, null, null, 0, 15, "desc"
        );

        assertThat(result).isNotNull();
        assertThat(result.content()).hasSize(2);
        assertThat(result.totalElements()).isEqualTo(2);

        TransactionDto dto1 = result.content().get(0);
        assertThat(dto1.symbol()).isEqualTo("AAPL");
        assertThat(dto1.type()).isEqualTo("SELL");
        assertThat(dto1.tradingMode()).isEqualTo("SWING");
        assertThat(dto1.quantity()).isEqualByComparingTo("5");
        assertThat(dto1.executionPrice()).isEqualByComparingTo("230.00");
        assertThat(dto1.totalAmount()).isEqualByComparingTo("1150.00");
        assertThat(dto1.status()).isEqualTo("EXECUTED");

        TransactionDto dto2 = result.content().get(1);
        assertThat(dto2.symbol()).isEqualTo("RELIANCE");
        assertThat(dto2.type()).isEqualTo("BUY");
        assertThat(dto2.tradingMode()).isEqualTo("INTRADAY");
        assertThat(dto2.quantity()).isEqualByComparingTo("10");
        assertThat(dto2.executionPrice()).isEqualByComparingTo("2950.00");
        assertThat(dto2.totalAmount()).isEqualByComparingTo("29500.00");
    }

    @Test
    @DisplayName("2. Filter by TransactionType BUY")
    void testFilterByBuy() {
        when(transactionRepository.findUserTransactions(
                eq(10L), eq(TransactionType.BUY), isNull(), isNull(), isNull(), isNull(), any(Pageable.class)
        )).thenReturn(new PageImpl<>(List.of(txBuy)));

        PageResponseDto<TransactionDto> result = transactionService.getUserTransactions(
                10L, "BUY", null, null, null, null, 0, 10, "desc"
        );

        assertThat(result.content()).hasSize(1);
        assertThat(result.content().get(0).type()).isEqualTo("BUY");
        assertThat(result.content().get(0).symbol()).isEqualTo("RELIANCE");
    }

    @Test
    @DisplayName("3. Filter by TradingMode LONG_TERM")
    void testFilterByTradingMode() {
        when(transactionRepository.findUserTransactions(
                eq(10L), isNull(), eq(TradingMode.LONG_TERM), isNull(), isNull(), isNull(), any(Pageable.class)
        )).thenReturn(new PageImpl<>(List.of()));

        PageResponseDto<TransactionDto> result = transactionService.getUserTransactions(
                10L, null, "LONG_TERM", null, null, null, 0, 10, "desc"
        );

        assertThat(result.content()).isEmpty();
    }

    @Test
    @DisplayName("4. Filter by Symbol")
    void testFilterBySymbol() {
        when(transactionRepository.findUserTransactions(
                eq(10L), isNull(), isNull(), eq("AAPL"), isNull(), isNull(), any(Pageable.class)
        )).thenReturn(new PageImpl<>(List.of(txSell)));

        PageResponseDto<TransactionDto> result = transactionService.getUserTransactions(
                10L, null, null, "AAPL", null, null, 0, 10, "desc"
        );

        assertThat(result.content()).hasSize(1);
        assertThat(result.content().get(0).symbol()).isEqualTo("AAPL");
    }

    @Test
    @DisplayName("5. Filter by Date Range")
    void testFilterByDateRange() {
        Instant start = Instant.parse("2026-09-30T00:00:00Z");
        Instant end = Instant.parse("2026-09-30T23:59:59Z");

        when(transactionRepository.findUserTransactions(
                eq(10L), isNull(), isNull(), isNull(), eq(start), eq(end), any(Pageable.class)
        )).thenReturn(new PageImpl<>(List.of(txBuy, txSell)));

        PageResponseDto<TransactionDto> result = transactionService.getUserTransactions(
                10L, null, null, null, start, end, 0, 10, "asc"
        );

        assertThat(result.content()).hasSize(2);
    }

    @Test
    @DisplayName("6. Enforce user ID validation")
    void testNullUserIdThrowsException() {
        assertThatThrownBy(() -> transactionService.getUserTransactions(
                null, null, null, null, null, null, 0, 10, "desc"
        )).isInstanceOf(IllegalArgumentException.class);
    }
}
