package com.portfolio.controller;

import com.portfolio.dto.common.PageResponseDto;
import com.portfolio.dto.order.ConsolidatedTradeDto;
import com.portfolio.dto.order.OrderDto;
import com.portfolio.entity.User;
import com.portfolio.entity.enums.AuthProvider;
import com.portfolio.entity.enums.UserRole;
import com.portfolio.entity.enums.UserStatus;
import com.portfolio.repository.UserRepository;
import com.portfolio.security.jwt.JwtTokenProvider;
import com.portfolio.service.OrderService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class OrderControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JwtTokenProvider jwtTokenProvider;

    @MockBean
    private OrderService orderService;

    private User testUser;
    private String jwtToken;

    @BeforeEach
    void setUp() {
        userRepository.deleteAll();

        testUser = new User("trader_orders@example.com", "Active Trader");
        testUser.setPasswordHash("hashed_pw");
        testUser.setRole(UserRole.ROLE_USER);
        testUser.setStatus(UserStatus.ACTIVE);
        testUser.setProvider(AuthProvider.LOCAL);
        testUser = userRepository.save(testUser);

        jwtToken = jwtTokenProvider.generateToken(com.portfolio.security.UserPrincipal.create(testUser));
    }

    @Test
    @DisplayName("GET /api/orders returns raw orders")
    void testGetRawOrders() throws Exception {
        OrderDto orderDto = new OrderDto(
                88L, "BTC/USD", "Bitcoin", "CRYPTO", "USD",
                "SELL", "EXECUTED", "INTRADAY", "SHORT", 1,
                new BigDecimal("8179.04"), null, null, 45L, null,
                new BigDecimal("0.1000"), new BigDecimal("81790.35"), new BigDecimal("81790.35"),
                new BigDecimal("8179.04"), Instant.parse("2026-10-14T20:00:00Z"), Instant.parse("2026-10-14T20:00:00Z")
        );

        when(orderService.getUserOrders(eq(testUser.getId()), any(), any(), any(), any(), any(), any(), eq(0), eq(15), eq("desc")))
                .thenReturn(new PageResponseDto<>(List.of(orderDto), 0, 15, 1, 1, true, true));

        mockMvc.perform(get("/api/orders")
                        .header("Authorization", "Bearer " + jwtToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].id").value(88))
                .andExpect(jsonPath("$.content[0].symbol").value("BTC/USD"))
                .andExpect(jsonPath("$.content[0].orderType").value("SELL"));
    }

    @Test
    @DisplayName("GET /api/orders/trades returns consolidated trade with entry and exit matched by positionId")
    void testGetConsolidatedTradesEndpoint() throws Exception {
        ConsolidatedTradeDto trade = new ConsolidatedTradeDto(
                45L,
                88L,
                89L,
                "BTC/USD",
                "Bitcoin",
                "CRYPTO",
                "USD",
                "SHORT",
                "INTRADAY",
                1,
                new BigDecimal("0.1000"),
                new BigDecimal("81790.35"),
                new BigDecimal("81776.00"),
                new BigDecimal("81776.00"),
                new BigDecimal("1.44"),
                null,
                null,
                new BigDecimal("8179.04"),
                "CLOSED",
                Instant.parse("2026-10-14T20:00:00Z"),
                Instant.parse("2026-10-14T20:05:00Z")
        );

        when(orderService.getUserConsolidatedTrades(eq(testUser.getId()), any(), any(), any(), any(), any(), any(), eq(0), eq(15), eq("desc")))
                .thenReturn(new PageResponseDto<>(List.of(trade), 0, 15, 1, 1, true, true));

        mockMvc.perform(get("/api/orders/trades")
                        .header("Authorization", "Bearer " + jwtToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].tradeId").value(45))
                .andExpect(jsonPath("$.content[0].entryOrderId").value(88))
                .andExpect(jsonPath("$.content[0].exitOrderId").value(89))
                .andExpect(jsonPath("$.content[0].symbol").value("BTC/USD"))
                .andExpect(jsonPath("$.content[0].direction").value("SHORT"))
                .andExpect(jsonPath("$.content[0].entryPrice").value(81790.35))
                .andExpect(jsonPath("$.content[0].exitPrice").value(81776.00))
                .andExpect(jsonPath("$.content[0].realizedPnl").value(1.44))
                .andExpect(jsonPath("$.content[0].status").value("CLOSED"));
    }
}
