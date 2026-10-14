package com.portfolio.service;

import com.portfolio.dto.common.PageResponseDto;
import com.portfolio.dto.order.ConsolidatedTradeDto;
import com.portfolio.dto.order.OrderDto;
import com.portfolio.dto.trading.PositionDto;
import com.portfolio.entity.Order;
import com.portfolio.entity.Stock;
import com.portfolio.entity.User;
import com.portfolio.entity.enums.OrderStatus;
import com.portfolio.entity.enums.OrderType;
import com.portfolio.entity.enums.PositionSide;
import com.portfolio.entity.enums.PositionStatus;
import com.portfolio.entity.enums.TradingMode;
import com.portfolio.repository.OrderRepository;
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
import java.util.Collections;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OrderServiceTest {

    @Mock
    private OrderRepository orderRepository;

    @Mock
    private TradingService tradingService;

    @InjectMocks
    private OrderService orderService;

    private User testUser;
    private Stock stockReliance;
    private Stock stockApple;
    private Order orderBuy;
    private Order orderSell;

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
        orderBuy.setCreatedAt(Instant.parse("2026-09-30T10:00:00Z"));

        orderSell = new Order(testUser, stockApple, OrderType.SELL, new BigDecimal("5"), new BigDecimal("230.00"));
        orderSell.setId(502L);
        orderSell.setOrderStatus(OrderStatus.EXECUTED);
        orderSell.setTradingMode(TradingMode.SWING);
        orderSell.setExecutedPrice(new BigDecimal("230.00"));
        orderSell.setExecutedAt(Instant.parse("2026-09-30T14:30:00Z"));
        orderSell.setCreatedAt(Instant.parse("2026-09-30T14:30:00Z"));
    }

    @Test
    @DisplayName("1. Fetch all user orders with pagination and sorting")
    void testGetUserOrdersAll() {
        when(orderRepository.findUserOrders(
                eq(10L), isNull(), isNull(), isNull(), isNull(), isNull(), isNull(), any(Pageable.class)
        )).thenReturn(new PageImpl<>(List.of(orderSell, orderBuy)));

        PageResponseDto<OrderDto> result = orderService.getUserOrders(
                10L, null, null, null, null, null, null, 0, 15, "desc"
        );

        assertThat(result).isNotNull();
        assertThat(result.content()).hasSize(2);
        assertThat(result.totalElements()).isEqualTo(2);

        OrderDto dto1 = result.content().get(0);
        assertThat(dto1.symbol()).isEqualTo("AAPL");
        assertThat(dto1.orderType()).isEqualTo("SELL");
        assertThat(dto1.orderStatus()).isEqualTo("EXECUTED");
        assertThat(dto1.tradingMode()).isEqualTo("SWING");
        assertThat(dto1.quantity()).isEqualByComparingTo("5");
        assertThat(dto1.executedPrice()).isEqualByComparingTo("230.00");
        assertThat(dto1.totalAmount()).isEqualByComparingTo("1150.00");

        OrderDto dto2 = result.content().get(1);
        assertThat(dto2.symbol()).isEqualTo("RELIANCE");
        assertThat(dto2.orderType()).isEqualTo("BUY");
        assertThat(dto2.orderStatus()).isEqualTo("EXECUTED");
        assertThat(dto2.tradingMode()).isEqualTo("INTRADAY");
        assertThat(dto2.quantity()).isEqualByComparingTo("10");
        assertThat(dto2.executedPrice()).isEqualByComparingTo("2950.00");
        assertThat(dto2.totalAmount()).isEqualByComparingTo("29500.00");
    }

    @Test
    @DisplayName("2. Filter orders by OrderType BUY")
    void testFilterByBuy() {
        when(orderRepository.findUserOrders(
                eq(10L), eq(OrderType.BUY), isNull(), isNull(), isNull(), isNull(), isNull(), any(Pageable.class)
        )).thenReturn(new PageImpl<>(List.of(orderBuy)));

        PageResponseDto<OrderDto> result = orderService.getUserOrders(
                10L, "BUY", null, null, null, null, null, 0, 10, "desc"
        );

        assertThat(result.content()).hasSize(1);
        assertThat(result.content().get(0).orderType()).isEqualTo("BUY");
        assertThat(result.content().get(0).symbol()).isEqualTo("RELIANCE");
    }

    @Test
    @DisplayName("3. Filter orders by OrderStatus EXECUTED")
    void testFilterByStatus() {
        when(orderRepository.findUserOrders(
                eq(10L), isNull(), eq(OrderStatus.EXECUTED), isNull(), isNull(), isNull(), isNull(), any(Pageable.class)
        )).thenReturn(new PageImpl<>(List.of(orderSell, orderBuy)));

        PageResponseDto<OrderDto> result = orderService.getUserOrders(
                10L, null, "EXECUTED", null, null, null, null, 0, 10, "desc"
        );

        assertThat(result.content()).hasSize(2);
    }

    @Test
    @DisplayName("4. Filter orders by TradingMode SCALPING")
    void testFilterByTradingMode() {
        when(orderRepository.findUserOrders(
                eq(10L), isNull(), isNull(), eq(TradingMode.SCALPING), isNull(), isNull(), isNull(), any(Pageable.class)
        )).thenReturn(new PageImpl<>(List.of()));

        PageResponseDto<OrderDto> result = orderService.getUserOrders(
                10L, null, null, "SCALPING", null, null, null, 0, 10, "desc"
        );

        assertThat(result.content()).isEmpty();
    }

    @Test
    @DisplayName("5. Filter orders by Symbol")
    void testFilterBySymbol() {
        when(orderRepository.findUserOrders(
                eq(10L), isNull(), isNull(), isNull(), eq("AAPL"), isNull(), isNull(), any(Pageable.class)
        )).thenReturn(new PageImpl<>(List.of(orderSell)));

        PageResponseDto<OrderDto> result = orderService.getUserOrders(
                10L, null, null, null, "AAPL", null, null, 0, 10, "desc"
        );

        assertThat(result.content()).hasSize(1);
        assertThat(result.content().get(0).symbol()).isEqualTo("AAPL");
    }

    @Test
    @DisplayName("6. Enforce user ID validation")
    void testNullUserIdThrowsException() {
        assertThatThrownBy(() -> orderService.getUserOrders(
                null, null, null, null, null, null, null, 0, 10, "desc"
        )).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("7. Consolidated Trade - Completed SHORT trade pairs Order #88 entry & Order #89 closing BUY with +$1.44 P&L")
    void testCompletedShortTradeConsolidation() {
        Long userId = 10L;
        Long positionId = 45L;

        Stock btcStock = new Stock("BTC/USD", "Bitcoin", "CRYPTO", "USD");
        btcStock.setId(301L);

        // Entry Order #88: SELL SHORT
        Order entryOrder = new Order(testUser, btcStock, OrderType.SELL, new BigDecimal("0.1000"), new BigDecimal("81790.35"));
        entryOrder.setId(88L);
        entryOrder.setPositionId(positionId);
        entryOrder.setPositionSide(PositionSide.SHORT);
        entryOrder.setOrderStatus(OrderStatus.EXECUTED);
        entryOrder.setExecutedPrice(new BigDecimal("81790.35"));
        entryOrder.setExecutedAt(Instant.parse("2026-10-14T20:00:00Z"));
        entryOrder.setCreatedAt(Instant.parse("2026-10-14T20:00:00Z"));

        // Exit Order #89: BUY TO CLOSE
        Order exitOrder = new Order(testUser, btcStock, OrderType.BUY, new BigDecimal("0.1000"), new BigDecimal("81776.00"));
        exitOrder.setId(89L);
        exitOrder.setPositionId(positionId);
        exitOrder.setPositionSide(PositionSide.SHORT);
        exitOrder.setOrderStatus(OrderStatus.EXECUTED);
        exitOrder.setExecutedPrice(new BigDecimal("81776.00"));
        exitOrder.setRealizedPnl(new BigDecimal("1.44"));
        exitOrder.setExecutedAt(Instant.parse("2026-10-14T20:05:00Z"));
        exitOrder.setCreatedAt(Instant.parse("2026-10-14T20:05:00Z"));

        PositionDto closedPosition = new PositionDto(
                positionId,
                "BTC/USD",
                "Bitcoin",
                "CRYPTO",
                "USD",
                PositionSide.SHORT,
                TradingMode.INTRADAY,
                new BigDecimal("0.1000"),
                new BigDecimal("81790.35"),
                new BigDecimal("81776.00"),
                1,
                new BigDecimal("8179.04"),
                new BigDecimal("8177.60"),
                null,
                null,
                null,
                null,
                PositionStatus.CLOSED,
                new BigDecimal("81776.00"),
                Instant.parse("2026-10-14T20:05:00Z"),
                new BigDecimal("1.44"),
                Instant.parse("2026-10-14T20:00:00Z")
        );

        when(tradingService.getUserPositions(userId, null, null)).thenReturn(List.of(closedPosition));
        when(orderRepository.findByUserIdAndPositionIdIsNotNullOrderByCreatedAtAsc(userId))
                .thenReturn(List.of(entryOrder, exitOrder));

        PageResponseDto<ConsolidatedTradeDto> response = orderService.getUserConsolidatedTrades(
                userId, null, null, null, null, null, null, 0, 15, "desc"
        );

        assertThat(response).isNotNull();
        assertThat(response.content()).hasSize(1);
        ConsolidatedTradeDto trade = response.content().get(0);

        assertThat(trade.tradeId()).isEqualTo(positionId);
        assertThat(trade.entryOrderId()).isEqualTo(88L);
        assertThat(trade.exitOrderId()).isEqualTo(89L);
        assertThat(trade.symbol()).isEqualTo("BTC/USD");
        assertThat(trade.direction()).isEqualTo("SHORT");
        assertThat(trade.quantity()).isEqualByComparingTo("0.1000");
        assertThat(trade.entryPrice()).isEqualByComparingTo("81790.35");
        assertThat(trade.exitPrice()).isEqualByComparingTo("81776.00");
        assertThat(trade.realizedPnl()).isEqualByComparingTo("1.44");
        assertThat(trade.status()).isEqualTo("CLOSED");
        assertThat(trade.openTime()).isEqualTo(Instant.parse("2026-10-14T20:00:00Z"));
        assertThat(trade.closeTime()).isEqualTo(Instant.parse("2026-10-14T20:05:00Z"));
    }

    @Test
    @DisplayName("8. Consolidated Trade - Completed LONG trade pairs BUY entry & SELL closing with realized P&L")
    void testCompletedLongTradeConsolidation() {
        Long userId = 10L;
        Long positionId = 50L;

        Order entryOrder = new Order(testUser, stockApple, OrderType.BUY, new BigDecimal("10"), new BigDecimal("150.00"));
        entryOrder.setId(91L);
        entryOrder.setPositionId(positionId);
        entryOrder.setPositionSide(PositionSide.LONG);
        entryOrder.setOrderStatus(OrderStatus.EXECUTED);
        entryOrder.setExecutedPrice(new BigDecimal("150.00"));
        entryOrder.setExecutedAt(Instant.parse("2026-10-14T10:00:00Z"));
        entryOrder.setCreatedAt(Instant.parse("2026-10-14T10:00:00Z"));

        Order exitOrder = new Order(testUser, stockApple, OrderType.SELL, new BigDecimal("10"), new BigDecimal("155.00"));
        exitOrder.setId(92L);
        exitOrder.setPositionId(positionId);
        exitOrder.setPositionSide(PositionSide.LONG);
        exitOrder.setOrderStatus(OrderStatus.EXECUTED);
        exitOrder.setExecutedPrice(new BigDecimal("155.00"));
        exitOrder.setRealizedPnl(new BigDecimal("50.00"));
        exitOrder.setExecutedAt(Instant.parse("2026-10-14T11:00:00Z"));
        exitOrder.setCreatedAt(Instant.parse("2026-10-14T11:00:00Z"));

        PositionDto closedPosition = new PositionDto(
                positionId,
                "AAPL",
                "Apple Inc.",
                "NASDAQ",
                "USD",
                PositionSide.LONG,
                TradingMode.INTRADAY,
                new BigDecimal("10"),
                new BigDecimal("150.00"),
                new BigDecimal("155.00"),
                1,
                new BigDecimal("1500.00"),
                new BigDecimal("1550.00"),
                null,
                null,
                null,
                null,
                PositionStatus.CLOSED,
                new BigDecimal("155.00"),
                Instant.parse("2026-10-14T11:00:00Z"),
                new BigDecimal("50.00"),
                Instant.parse("2026-10-14T10:00:00Z")
        );

        when(tradingService.getUserPositions(userId, null, null)).thenReturn(List.of(closedPosition));
        when(orderRepository.findByUserIdAndPositionIdIsNotNullOrderByCreatedAtAsc(userId))
                .thenReturn(List.of(entryOrder, exitOrder));

        PageResponseDto<ConsolidatedTradeDto> response = orderService.getUserConsolidatedTrades(
                userId, null, null, null, null, null, null, 0, 15, "desc"
        );

        assertThat(response.content()).hasSize(1);
        ConsolidatedTradeDto trade = response.content().get(0);
        assertThat(trade.tradeId()).isEqualTo(positionId);
        assertThat(trade.entryOrderId()).isEqualTo(91L);
        assertThat(trade.exitOrderId()).isEqualTo(92L);
        assertThat(trade.symbol()).isEqualTo("AAPL");
        assertThat(trade.direction()).isEqualTo("LONG");
        assertThat(trade.entryPrice()).isEqualByComparingTo("150.00");
        assertThat(trade.exitPrice()).isEqualByComparingTo("155.00");
        assertThat(trade.realizedPnl()).isEqualByComparingTo("50.00");
        assertThat(trade.status()).isEqualTo("CLOSED");
    }

    @Test
    @DisplayName("9. Consolidated Trade - Open trade shows current price, floating P&L, OPEN status and null exit price")
    void testOpenTradeConsolidation() {
        Long userId = 10L;
        Long positionId = 60L;

        Order entryOrder = new Order(testUser, stockReliance, OrderType.BUY, new BigDecimal("5"), new BigDecimal("3000.00"));
        entryOrder.setId(93L);
        entryOrder.setPositionId(positionId);
        entryOrder.setPositionSide(PositionSide.LONG);
        entryOrder.setOrderStatus(OrderStatus.EXECUTED);
        entryOrder.setExecutedPrice(new BigDecimal("3000.00"));
        entryOrder.setExecutedAt(Instant.parse("2026-10-14T15:00:00Z"));
        entryOrder.setCreatedAt(Instant.parse("2026-10-14T15:00:00Z"));

        PositionDto openPosition = new PositionDto(
                positionId,
                "RELIANCE",
                "Reliance Industries Ltd",
                "NSE",
                "INR",
                PositionSide.LONG,
                TradingMode.INTRADAY,
                new BigDecimal("5"),
                new BigDecimal("3000.00"),
                new BigDecimal("3050.00"),
                1,
                new BigDecimal("15000.00"),
                new BigDecimal("15250.00"),
                new BigDecimal("250.00"),
                new BigDecimal("1.67"),
                null,
                null,
                PositionStatus.OPEN,
                null,
                null,
                null,
                Instant.parse("2026-10-14T15:00:00Z")
        );

        when(tradingService.getUserPositions(userId, null, null)).thenReturn(List.of(openPosition));
        when(orderRepository.findByUserIdAndPositionIdIsNotNullOrderByCreatedAtAsc(userId))
                .thenReturn(List.of(entryOrder));

        PageResponseDto<ConsolidatedTradeDto> response = orderService.getUserConsolidatedTrades(
                userId, null, null, null, null, null, null, 0, 15, "desc"
        );

        assertThat(response.content()).hasSize(1);
        ConsolidatedTradeDto trade = response.content().get(0);
        assertThat(trade.tradeId()).isEqualTo(positionId);
        assertThat(trade.entryOrderId()).isEqualTo(93L);
        assertThat(trade.exitOrderId()).isNull();
        assertThat(trade.exitPrice()).isNull();
        assertThat(trade.currentPrice()).isEqualByComparingTo("3050.00");
        assertThat(trade.unrealizedPnl()).isEqualByComparingTo("250.00");
        assertThat(trade.realizedPnl()).isNull();
        assertThat(trade.status()).isEqualTo("OPEN");
    }

    @Test
    @DisplayName("10. Consolidated Trade - Multiple trades on same symbol matched strictly by positionId without cross-pairing")
    void testMultipleTradesOnSameSymbolDoNotCrossMatch() {
        Long userId = 10L;
        Long posId1 = 70L;
        Long posId2 = 71L;

        Stock btcStock = new Stock("BTC/USD", "Bitcoin", "CRYPTO", "USD");
        btcStock.setId(301L);

        // Trade 1: Entry #101, Exit #102
        Order entry1 = new Order(testUser, btcStock, OrderType.BUY, new BigDecimal("0.1"), new BigDecimal("80000.00"));
        entry1.setId(101L);
        entry1.setPositionId(posId1);
        entry1.setPositionSide(PositionSide.LONG);
        entry1.setExecutedPrice(new BigDecimal("80000.00"));
        entry1.setCreatedAt(Instant.parse("2026-10-14T08:00:00Z"));

        Order exit1 = new Order(testUser, btcStock, OrderType.SELL, new BigDecimal("0.1"), new BigDecimal("80500.00"));
        exit1.setId(102L);
        exit1.setPositionId(posId1);
        exit1.setPositionSide(PositionSide.LONG);
        exit1.setExecutedPrice(new BigDecimal("80500.00"));
        exit1.setRealizedPnl(new BigDecimal("50.00"));
        exit1.setCreatedAt(Instant.parse("2026-10-14T08:30:00Z"));

        // Trade 2: Entry #103, Exit #104
        Order entry2 = new Order(testUser, btcStock, OrderType.SELL, new BigDecimal("0.1"), new BigDecimal("81000.00"));
        entry2.setId(103L);
        entry2.setPositionId(posId2);
        entry2.setPositionSide(PositionSide.SHORT);
        entry2.setExecutedPrice(new BigDecimal("81000.00"));
        entry2.setCreatedAt(Instant.parse("2026-10-14T09:00:00Z"));

        Order exit2 = new Order(testUser, btcStock, OrderType.BUY, new BigDecimal("0.1"), new BigDecimal("80800.00"));
        exit2.setId(104L);
        exit2.setPositionId(posId2);
        exit2.setPositionSide(PositionSide.SHORT);
        exit2.setExecutedPrice(new BigDecimal("80800.00"));
        exit2.setRealizedPnl(new BigDecimal("20.00"));
        exit2.setCreatedAt(Instant.parse("2026-10-14T09:30:00Z"));

        PositionDto pos1 = new PositionDto(posId1, "BTC/USD", "Bitcoin", "CRYPTO", "USD", PositionSide.LONG, TradingMode.INTRADAY,
                new BigDecimal("0.1"), new BigDecimal("80000.00"), new BigDecimal("80500.00"), 1, new BigDecimal("8000.00"),
                new BigDecimal("8050.00"), null, null, null, null, PositionStatus.CLOSED, new BigDecimal("80500.00"),
                Instant.parse("2026-10-14T08:30:00Z"), new BigDecimal("50.00"), Instant.parse("2026-10-14T08:00:00Z"));

        PositionDto pos2 = new PositionDto(posId2, "BTC/USD", "Bitcoin", "CRYPTO", "USD", PositionSide.SHORT, TradingMode.INTRADAY,
                new BigDecimal("0.1"), new BigDecimal("81000.00"), new BigDecimal("80800.00"), 1, new BigDecimal("8100.00"),
                new BigDecimal("8080.00"), null, null, null, null, PositionStatus.CLOSED, new BigDecimal("80800.00"),
                Instant.parse("2026-10-14T09:30:00Z"), new BigDecimal("20.00"), Instant.parse("2026-10-14T09:00:00Z"));

        when(tradingService.getUserPositions(userId, null, null)).thenReturn(List.of(pos1, pos2));
        when(orderRepository.findByUserIdAndPositionIdIsNotNullOrderByCreatedAtAsc(userId))
                .thenReturn(List.of(entry1, exit1, entry2, exit2));

        PageResponseDto<ConsolidatedTradeDto> response = orderService.getUserConsolidatedTrades(
                userId, null, null, null, null, null, null, 0, 15, "asc"
        );

        assertThat(response.content()).hasSize(2);

        ConsolidatedTradeDto trade1 = response.content().get(0);
        assertThat(trade1.tradeId()).isEqualTo(posId1);
        assertThat(trade1.entryOrderId()).isEqualTo(101L);
        assertThat(trade1.exitOrderId()).isEqualTo(102L);
        assertThat(trade1.direction()).isEqualTo("LONG");
        assertThat(trade1.realizedPnl()).isEqualByComparingTo("50.00");

        ConsolidatedTradeDto trade2 = response.content().get(1);
        assertThat(trade2.tradeId()).isEqualTo(posId2);
        assertThat(trade2.entryOrderId()).isEqualTo(103L);
        assertThat(trade2.exitOrderId()).isEqualTo(104L);
        assertThat(trade2.direction()).isEqualTo("SHORT");
        assertThat(trade2.realizedPnl()).isEqualByComparingTo("20.00");
    }

    @Test
    @DisplayName("11. Unrelated and pending orders without positionId are excluded from consolidated trades")
    void testUnrelatedOrdersExcludedFromConsolidatedTrades() {
        Long userId = 10L;

        // Pending order with no positionId
        Order pendingOrder = new Order(testUser, stockApple, OrderType.BUY, new BigDecimal("2"), new BigDecimal("140.00"));
        pendingOrder.setId(999L);
        pendingOrder.setOrderStatus(OrderStatus.PENDING);
        pendingOrder.setPositionId(null);

        when(tradingService.getUserPositions(userId, null, null)).thenReturn(Collections.emptyList());
        when(orderRepository.findByUserIdAndPositionIdIsNotNullOrderByCreatedAtAsc(userId)).thenReturn(Collections.emptyList());

        PageResponseDto<ConsolidatedTradeDto> response = orderService.getUserConsolidatedTrades(
                userId, null, null, null, null, null, null, 0, 15, "desc"
        );

        assertThat(response.content()).isEmpty();
        assertThat(response.totalElements()).isEqualTo(0);
    }
}

