package com.portfolio.service;

import com.portfolio.dto.market.StockQuoteDto;
import com.portfolio.dto.trading.*;
import com.portfolio.entity.*;
import com.portfolio.entity.enums.*;
import com.portfolio.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TradingServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private StockRepository stockRepository;

    @Mock
    private HoldingRepository holdingRepository;

    @Mock
    private OrderRepository orderRepository;

    @Mock
    private TransactionRepository transactionRepository;

    @Mock
    private PositionRepository positionRepository;

    @Mock
    private MarketDataService marketDataService;

    @Mock
    private UpstoxService upstoxService;

    @InjectMocks
    private TradingService tradingService;

    private User testUser;
    private Stock testStock;

    @BeforeEach
    void setUp() {
        testUser = new User("investor@example.com", "John Doe");
        testUser.setId(1L);

        testStock = new Stock("RELIANCE", "Reliance Industries Ltd", "NSE", "INR");
        testStock.setId(10L);
        testStock.setCurrentPrice(new BigDecimal("2950.0000"));
    }

    @Test
    @DisplayName("BUY - Successful leveraged purchase with margin calculation")
    void testExecuteBuySuccess() {
        TradeRequestDto request = new TradeRequestDto("RELIANCE", new BigDecimal("10"), TradingMode.INTRADAY, PositionSide.LONG, 10, null, null);
        StockQuoteDto mockQuote = new StockQuoteDto(
                "RELIANCE", "Reliance Industries Ltd", new BigDecimal("2950.0000"),
                BigDecimal.ZERO, "0%", BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, 1000L, "2026-09-30", 1727690000L
        );

        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser));
        when(upstoxService.isIndianSymbol("RELIANCE")).thenReturn(true);
        when(upstoxService.getQuote("RELIANCE")).thenReturn(mockQuote);
        when(transactionRepository.findByUserId(1L)).thenReturn(Collections.emptyList());
        when(stockRepository.findBySymbol("RELIANCE")).thenReturn(Optional.of(testStock));
        when(stockRepository.save(any(Stock.class))).thenAnswer(i -> i.getArgument(0));
        when(positionRepository.save(any(Position.class))).thenAnswer(i -> {
            Position p = i.getArgument(0);
            p.setId(50L);
            return p;
        });
        when(orderRepository.save(any(Order.class))).thenAnswer(i -> {
            Order o = i.getArgument(0);
            o.setId(100L);
            return o;
        });
        when(holdingRepository.findByUserIdAndStock_Symbol(1L, "RELIANCE")).thenReturn(Optional.empty());
        when(holdingRepository.save(any(Holding.class))).thenAnswer(i -> i.getArgument(0));
        when(transactionRepository.save(any(Transaction.class))).thenAnswer(i -> {
            Transaction t = i.getArgument(0);
            t.setId(200L);
            return t;
        });

        TradeResponseDto response = tradingService.executeBuy(1L, request);

        assertThat(response).isNotNull();
        assertThat(response.symbol()).isEqualTo("RELIANCE");
        assertThat(response.orderType()).isEqualTo(OrderType.BUY);
        assertThat(response.positionSide()).isEqualTo(PositionSide.LONG);
        assertThat(response.orderStatus()).isEqualTo(OrderStatus.EXECUTED);
        assertThat(response.quantity()).isEqualByComparingTo("10");
        assertThat(response.executionPrice()).isEqualByComparingTo("2950.0000");
        assertThat(response.leverage()).isEqualTo(10);
        assertThat(response.marginUsed()).isEqualByComparingTo("2950.0000"); // 29500 / 10
        assertThat(response.remainingCashBalance()).isEqualByComparingTo("97050.0000"); // 100000 - 2950

        verify(positionRepository).save(any(Position.class));
        verify(orderRepository).save(any(Order.class));
        verify(transactionRepository).save(any(Transaction.class));
    }

    @Test
    @DisplayName("BUY - Fails when virtual cash balance is insufficient for margin")
    void testExecuteBuyInsufficientBalance() {
        // 1000 shares * 2950 = 2,950,000 / 10 = 295,000 margin > 100,000 cash
        TradeRequestDto request = new TradeRequestDto("RELIANCE", new BigDecimal("1000"), TradingMode.INTRADAY, PositionSide.LONG, 10, null, null);
        StockQuoteDto mockQuote = new StockQuoteDto(
                "RELIANCE", "Reliance Industries Ltd", new BigDecimal("2950.0000"),
                BigDecimal.ZERO, "0%", BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, 1000L, "2026-09-30", 1727690000L
        );

        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser));
        when(upstoxService.isIndianSymbol("RELIANCE")).thenReturn(true);
        when(upstoxService.getQuote("RELIANCE")).thenReturn(mockQuote);
        when(transactionRepository.findByUserId(1L)).thenReturn(Collections.emptyList());

        assertThatThrownBy(() -> tradingService.executeBuy(1L, request))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Insufficient virtual balance for required margin");

        verify(positionRepository, never()).save(any());
        verify(orderRepository, never()).save(any());
    }

    @Test
    @DisplayName("SELL - Opens SHORT position with leverage when no spot holdings owned")
    void testExecuteSellShortPosition() {
        TradeRequestDto request = new TradeRequestDto("RELIANCE", new BigDecimal("5"), TradingMode.SCALPING, PositionSide.SHORT, 20, null, null);
        StockQuoteDto mockQuote = new StockQuoteDto(
                "RELIANCE", "Reliance Industries Ltd", new BigDecimal("3000.0000"),
                BigDecimal.ZERO, "0%", BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, 1000L, "2026-09-30", 1727690000L
        );

        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser));
        when(upstoxService.isIndianSymbol("RELIANCE")).thenReturn(true);
        when(upstoxService.getQuote("RELIANCE")).thenReturn(mockQuote);
        when(transactionRepository.findByUserId(1L)).thenReturn(Collections.emptyList());
        when(stockRepository.findBySymbol("RELIANCE")).thenReturn(Optional.of(testStock));
        when(stockRepository.save(any(Stock.class))).thenAnswer(i -> i.getArgument(0));
        when(positionRepository.save(any(Position.class))).thenAnswer(i -> {
            Position p = i.getArgument(0);
            p.setId(51L);
            return p;
        });
        when(orderRepository.save(any(Order.class))).thenAnswer(i -> {
            Order o = i.getArgument(0);
            o.setId(101L);
            return o;
        });
        when(transactionRepository.save(any(Transaction.class))).thenAnswer(i -> {
            Transaction t = i.getArgument(0);
            t.setId(201L);
            return t;
        });

        TradeResponseDto response = tradingService.executeSell(1L, request);

        assertThat(response).isNotNull();
        assertThat(response.orderType()).isEqualTo(OrderType.SELL);
        assertThat(response.positionSide()).isEqualTo(PositionSide.SHORT);
        assertThat(response.leverage()).isEqualTo(20);
        assertThat(response.marginUsed()).isEqualByComparingTo("750.0000"); // (5 * 3000) / 20 = 750
        assertThat(response.remainingCashBalance()).isEqualByComparingTo("99250.0000"); // 100000 - 750

        verify(positionRepository).save(any(Position.class));
    }

    @Test
    @DisplayName("SELL - Successful sale of owned spot holdings")
    void testExecuteSellSpotHolding() {
        TradeRequestDto request = new TradeRequestDto("RELIANCE", new BigDecimal("5"), TradingMode.SWING, PositionSide.LONG, 1, null, null);
        StockQuoteDto mockQuote = new StockQuoteDto(
                "RELIANCE", "Reliance Industries Ltd", new BigDecimal("3000.0000"),
                BigDecimal.ZERO, "0%", BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, 1000L, "2026-09-30", 1727690000L
        );

        Holding existingHolding = new Holding(testUser, testStock, new BigDecimal("10"), new BigDecimal("2900"), new BigDecimal("29000"));

        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser));
        when(holdingRepository.findByUserIdAndStock_Symbol(1L, "RELIANCE")).thenReturn(Optional.of(existingHolding));
        when(upstoxService.isIndianSymbol("RELIANCE")).thenReturn(true);
        when(upstoxService.getQuote("RELIANCE")).thenReturn(mockQuote);
        when(stockRepository.findBySymbol("RELIANCE")).thenReturn(Optional.of(testStock));
        when(stockRepository.save(any(Stock.class))).thenAnswer(i -> i.getArgument(0));
        when(orderRepository.save(any(Order.class))).thenAnswer(i -> {
            Order o = i.getArgument(0);
            o.setId(101L);
            return o;
        });
        when(transactionRepository.save(any(Transaction.class))).thenAnswer(i -> {
            Transaction t = i.getArgument(0);
            t.setId(201L);
            return t;
        });
        when(transactionRepository.findByUserId(1L)).thenReturn(Collections.emptyList());

        TradeResponseDto response = tradingService.executeSell(1L, request);

        assertThat(response).isNotNull();
        assertThat(response.orderType()).isEqualTo(OrderType.SELL);
        assertThat(response.quantity()).isEqualByComparingTo("5");
        assertThat(response.executionPrice()).isEqualByComparingTo("3000.0000");
        assertThat(response.totalAmount()).isEqualByComparingTo("15000.0000");
        assertThat(response.currentHoldingQuantity()).isEqualByComparingTo("5"); // 10 - 5

        verify(holdingRepository).save(existingHolding);
        verify(orderRepository).save(any(Order.class));
        verify(transactionRepository).save(any(Transaction.class));
    }

    @Test
    @DisplayName("CLOSE POSITION - Closes open position, calculates realized P&L, releases margin")
    void testClosePosition() {
        Position openPos = new Position(testUser, testStock, PositionSide.LONG, TradingMode.INTRADAY,
                new BigDecimal("2.0000"), new BigDecimal("2900.0000"), 10, new BigDecimal("580.0000"), null, null);
        openPos.setId(99L);
        openPos.setStatus(PositionStatus.OPEN);

        StockQuoteDto mockQuote = new StockQuoteDto(
                "RELIANCE", "Reliance Industries Ltd", new BigDecimal("3100.0000"),
                BigDecimal.ZERO, "0%", BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, 1000L, "2026-09-30", 1727690000L
        );

        when(positionRepository.findByIdAndUserId(99L, 1L)).thenReturn(Optional.of(openPos));
        when(upstoxService.isIndianSymbol("RELIANCE")).thenReturn(true);
        when(upstoxService.getQuote("RELIANCE")).thenReturn(mockQuote);
        when(positionRepository.save(any(Position.class))).thenAnswer(i -> i.getArgument(0));

        PositionDto closed = tradingService.closePosition(1L, 99L, null);

        assertThat(closed).isNotNull();
        assertThat(closed.status()).isEqualTo(PositionStatus.CLOSED);
        assertThat(closed.closePrice()).isEqualByComparingTo("3100.0000");
        assertThat(closed.realizedPnl()).isEqualByComparingTo("400.0000"); // (3100 - 2900) * 2 = +400

        verify(positionRepository).save(openPos);
        verify(orderRepository).save(any(Order.class));
        verify(transactionRepository).save(any(Transaction.class));
    }

    @Test
    @DisplayName("BUY/SELL - Rejects zero or negative quantity")
    void testInvalidQuantity() {
        TradeRequestDto zeroQty = new TradeRequestDto("RELIANCE", BigDecimal.ZERO);
        TradeRequestDto negativeQty = new TradeRequestDto("RELIANCE", new BigDecimal("-5"));

        assertThatThrownBy(() -> tradingService.executeBuy(1L, zeroQty))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Quantity must be greater than zero");

        assertThatThrownBy(() -> tradingService.executeSell(1L, negativeQty))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Quantity must be greater than zero");
    }

    @Test
    @DisplayName("WALLET - Calculates ledger balance and portfolio value accurately")
    void testGetWallet() {
        Transaction t1 = new Transaction(testUser, testStock, TransactionType.BUY, new BigDecimal("20000.0000"));
        t1.setStatus(TransactionStatus.SUCCESS);

        Holding holding = new Holding(testUser, testStock, new BigDecimal("10"), new BigDecimal("2000.0000"), new BigDecimal("20000.0000"));

        when(transactionRepository.findByUserId(1L)).thenReturn(List.of(t1));
        when(holdingRepository.findByUserId(1L)).thenReturn(List.of(holding));
        when(positionRepository.findByUserIdAndStatus(1L, PositionStatus.OPEN)).thenReturn(Collections.emptyList());

        VirtualWalletDto wallet = tradingService.getWallet(1L);

        assertThat(wallet).isNotNull();
        assertThat(wallet.cashBalance()).isEqualByComparingTo("80000.00"); // 100,000 - 20,000
        assertThat(wallet.totalInvested()).isEqualByComparingTo("20000.00");
        assertThat(wallet.totalPortfolioValue()).isEqualByComparingTo("109500.00"); // 80,000 cash + (10 * 2950 stock price)
    }

    @Test
    @DisplayName("DEPOSIT - Adds virtual cash and records transaction")
    void testDepositCash() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser));
        when(transactionRepository.findByUserId(1L)).thenReturn(Collections.emptyList());
        when(holdingRepository.findByUserId(1L)).thenReturn(Collections.emptyList());
        when(positionRepository.findByUserIdAndStatus(1L, PositionStatus.OPEN)).thenReturn(Collections.emptyList());

        VirtualWalletDto wallet = tradingService.depositCash(1L, new BigDecimal("25000"));

        assertThat(wallet).isNotNull();
        verify(transactionRepository).save(argThat(tx ->
                tx.getTransactionType() == TransactionType.DEPOSIT &&
                tx.getTotalAmount().compareTo(new BigDecimal("25000")) == 0
        ));
    }

    @Test
    @DisplayName("RESET BALANCE - Adjusts virtual cash to target amount")
    void testResetCashBalance() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser));
        when(transactionRepository.findByUserId(1L)).thenReturn(Collections.emptyList());
        when(holdingRepository.findByUserId(1L)).thenReturn(Collections.emptyList());
        when(positionRepository.findByUserIdAndStatus(1L, PositionStatus.OPEN)).thenReturn(Collections.emptyList());

        VirtualWalletDto wallet = tradingService.resetCashBalance(1L, new BigDecimal("150000"));

        assertThat(wallet).isNotNull();
        verify(transactionRepository).save(argThat(tx ->
                tx.getTransactionType() == TransactionType.DEPOSIT &&
                tx.getTotalAmount().compareTo(new BigDecimal("50000")) == 0
        ));
    }

    @Test
    @DisplayName("USER ISOLATION - Ensures queries are strictly scoped to authenticated user ID")
    void testUserIsolation() {
        Long userA = 1L;
        Long userB = 2L;

        when(holdingRepository.findByUserId(userA)).thenReturn(Collections.emptyList());
        when(holdingRepository.findByUserId(userB)).thenReturn(List.of(new Holding(new User("other@test.com", "Other"), testStock, BigDecimal.ONE, BigDecimal.TEN, BigDecimal.TEN)));

        List<UserHoldingDto> holdingsA = tradingService.getUserHoldings(userA);
        List<UserHoldingDto> holdingsB = tradingService.getUserHoldings(userB);

        assertThat(holdingsA).isEmpty();
        assertThat(holdingsB).hasSize(1);
    }
}
