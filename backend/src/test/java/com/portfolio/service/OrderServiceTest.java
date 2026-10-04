package com.portfolio.service;

import com.portfolio.dto.common.PageResponseDto;
import com.portfolio.dto.order.OrderDto;
import com.portfolio.entity.Order;
import com.portfolio.entity.Stock;
import com.portfolio.entity.User;
import com.portfolio.entity.enums.OrderStatus;
import com.portfolio.entity.enums.OrderType;
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
        orderBuy.setExecutedPrice(new BigDecimal("2950.00"));
        orderBuy.setExecutedAt(Instant.parse("2026-09-30T10:00:00Z"));
        orderBuy.setCreatedAt(Instant.parse("2026-09-30T10:00:00Z"));

        orderSell = new Order(testUser, stockApple, OrderType.SELL, new BigDecimal("5"), new BigDecimal("230.00"));
        orderSell.setId(502L);
        orderSell.setOrderStatus(OrderStatus.EXECUTED);
        orderSell.setExecutedPrice(new BigDecimal("230.00"));
        orderSell.setExecutedAt(Instant.parse("2026-09-30T14:30:00Z"));
        orderSell.setCreatedAt(Instant.parse("2026-09-30T14:30:00Z"));
    }

    @Test
    @DisplayName("1. Fetch all user orders with pagination and sorting")
    void testGetUserOrdersAll() {
        when(orderRepository.findUserOrders(
                eq(10L), isNull(), isNull(), isNull(), isNull(), isNull(), any(Pageable.class)
        )).thenReturn(new PageImpl<>(List.of(orderSell, orderBuy)));

        PageResponseDto<OrderDto> result = orderService.getUserOrders(
                10L, null, null, null, null, null, 0, 15, "desc"
        );

        assertThat(result).isNotNull();
        assertThat(result.content()).hasSize(2);
        assertThat(result.totalElements()).isEqualTo(2);

        OrderDto dto1 = result.content().get(0);
        assertThat(dto1.symbol()).isEqualTo("AAPL");
        assertThat(dto1.orderType()).isEqualTo("SELL");
        assertThat(dto1.orderStatus()).isEqualTo("EXECUTED");
        assertThat(dto1.quantity()).isEqualByComparingTo("5");
        assertThat(dto1.executedPrice()).isEqualByComparingTo("230.00");
        assertThat(dto1.totalAmount()).isEqualByComparingTo("1150.00");

        OrderDto dto2 = result.content().get(1);
        assertThat(dto2.symbol()).isEqualTo("RELIANCE");
        assertThat(dto2.orderType()).isEqualTo("BUY");
        assertThat(dto2.orderStatus()).isEqualTo("EXECUTED");
        assertThat(dto2.quantity()).isEqualByComparingTo("10");
        assertThat(dto2.executedPrice()).isEqualByComparingTo("2950.00");
        assertThat(dto2.totalAmount()).isEqualByComparingTo("29500.00");
    }

    @Test
    @DisplayName("2. Filter orders by OrderType BUY")
    void testFilterByBuy() {
        when(orderRepository.findUserOrders(
                eq(10L), eq(OrderType.BUY), isNull(), isNull(), isNull(), isNull(), any(Pageable.class)
        )).thenReturn(new PageImpl<>(List.of(orderBuy)));

        PageResponseDto<OrderDto> result = orderService.getUserOrders(
                10L, "BUY", null, null, null, null, 0, 10, "desc"
        );

        assertThat(result.content()).hasSize(1);
        assertThat(result.content().get(0).orderType()).isEqualTo("BUY");
        assertThat(result.content().get(0).symbol()).isEqualTo("RELIANCE");
    }

    @Test
    @DisplayName("3. Filter orders by OrderStatus EXECUTED")
    void testFilterByStatus() {
        when(orderRepository.findUserOrders(
                eq(10L), isNull(), eq(OrderStatus.EXECUTED), isNull(), isNull(), isNull(), any(Pageable.class)
        )).thenReturn(new PageImpl<>(List.of(orderSell, orderBuy)));

        PageResponseDto<OrderDto> result = orderService.getUserOrders(
                10L, null, "EXECUTED", null, null, null, 0, 10, "desc"
        );

        assertThat(result.content()).hasSize(2);
    }

    @Test
    @DisplayName("4. Filter orders by Symbol")
    void testFilterBySymbol() {
        when(orderRepository.findUserOrders(
                eq(10L), isNull(), isNull(), eq("AAPL"), isNull(), isNull(), any(Pageable.class)
        )).thenReturn(new PageImpl<>(List.of(orderSell)));

        PageResponseDto<OrderDto> result = orderService.getUserOrders(
                10L, null, null, "AAPL", null, null, 0, 10, "desc"
        );

        assertThat(result.content()).hasSize(1);
        assertThat(result.content().get(0).symbol()).isEqualTo("AAPL");
    }

    @Test
    @DisplayName("5. Enforce user ID validation")
    void testNullUserIdThrowsException() {
        assertThatThrownBy(() -> orderService.getUserOrders(
                null, null, null, null, null, null, 0, 10, "desc"
        )).isInstanceOf(IllegalArgumentException.class);
    }
}
