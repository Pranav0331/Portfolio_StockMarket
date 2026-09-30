package com.portfolio.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.portfolio.dto.trading.TradeRequestDto;
import com.portfolio.dto.trading.TradeResponseDto;
import com.portfolio.dto.trading.UserHoldingDto;
import com.portfolio.dto.trading.VirtualWalletDto;
import com.portfolio.entity.User;
import com.portfolio.entity.enums.AuthProvider;
import com.portfolio.entity.enums.OrderStatus;
import com.portfolio.entity.enums.OrderType;
import com.portfolio.entity.enums.UserRole;
import com.portfolio.entity.enums.UserStatus;
import com.portfolio.repository.UserRepository;
import com.portfolio.security.jwt.JwtTokenProvider;
import com.portfolio.service.TradingService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class TradingControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JwtTokenProvider jwtTokenProvider;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private TradingService tradingService;

    private User testUser;
    private String jwtToken;

    @BeforeEach
    void setUp() {
        userRepository.deleteAll();

        testUser = new User("trader@example.com", "Active Trader");
        testUser.setPasswordHash("hashed_pw");
        testUser.setRole(UserRole.ROLE_USER);
        testUser.setStatus(UserStatus.ACTIVE);
        testUser.setProvider(AuthProvider.LOCAL);
        testUser = userRepository.save(testUser);

        jwtToken = jwtTokenProvider.generateToken(com.portfolio.security.UserPrincipal.create(testUser));
    }

    @Test
    @DisplayName("1. POST /api/trading/buy with JWT token executes BUY and returns HTTP 200")
    void testBuyEndpointSuccess() throws Exception {
        TradeRequestDto request = new TradeRequestDto("RELIANCE", new BigDecimal("10"));
        TradeResponseDto mockResponse = new TradeResponseDto(
                1L, 1L, "RELIANCE", "Reliance Industries Ltd",
                OrderType.BUY, OrderStatus.EXECUTED,
                new BigDecimal("10"), new BigDecimal("2950.00"), new BigDecimal("29500.00"),
                new BigDecimal("70500.00"), new BigDecimal("10"), Instant.now(),
                "Successfully bought 10 shares of RELIANCE"
        );

        when(tradingService.executeBuy(eq(testUser.getId()), any(TradeRequestDto.class)))
                .thenReturn(mockResponse);

        mockMvc.perform(post("/api/trading/buy")
                        .header("Authorization", "Bearer " + jwtToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.symbol").value("RELIANCE"))
                .andExpect(jsonPath("$.orderType").value("BUY"))
                .andExpect(jsonPath("$.orderStatus").value("EXECUTED"))
                .andExpect(jsonPath("$.quantity").value(10))
                .andExpect(jsonPath("$.executionPrice").value(2950.00))
                .andExpect(jsonPath("$.remainingCashBalance").value(70500.00));
    }

    @Test
    @DisplayName("2. POST /api/trading/sell with JWT token executes SELL and returns HTTP 200")
    void testSellEndpointSuccess() throws Exception {
        TradeRequestDto request = new TradeRequestDto("AAPL", new BigDecimal("5"));
        TradeResponseDto mockResponse = new TradeResponseDto(
                2L, 2L, "AAPL", "Apple Inc.",
                OrderType.SELL, OrderStatus.EXECUTED,
                new BigDecimal("5"), new BigDecimal("225.00"), new BigDecimal("1125.00"),
                new BigDecimal("101125.00"), new BigDecimal("5"), Instant.now(),
                "Successfully sold 5 shares of AAPL"
        );

        when(tradingService.executeSell(eq(testUser.getId()), any(TradeRequestDto.class)))
                .thenReturn(mockResponse);

        mockMvc.perform(post("/api/trading/sell")
                        .header("Authorization", "Bearer " + jwtToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.symbol").value("AAPL"))
                .andExpect(jsonPath("$.orderType").value("SELL"))
                .andExpect(jsonPath("$.quantity").value(5))
                .andExpect(jsonPath("$.totalAmount").value(1125.00));
    }

    @Test
    @DisplayName("3. GET /api/trading/wallet returns user's virtual cash balance and portfolio value")
    void testGetWalletEndpoint() throws Exception {
        VirtualWalletDto wallet = new VirtualWalletDto(
                new BigDecimal("85000.00"),
                new BigDecimal("15000.00"),
                new BigDecimal("102000.00"),
                "USD"
        );

        when(tradingService.getWallet(eq(testUser.getId()))).thenReturn(wallet);

        mockMvc.perform(get("/api/trading/wallet")
                        .header("Authorization", "Bearer " + jwtToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cashBalance").value(85000.00))
                .andExpect(jsonPath("$.totalInvested").value(15000.00))
                .andExpect(jsonPath("$.totalPortfolioValue").value(102000.00));
    }

    @Test
    @DisplayName("4. GET /api/trading/holdings returns list of user holdings")
    void testGetHoldingsEndpoint() throws Exception {
        UserHoldingDto holding = new UserHoldingDto(
                1L, "RELIANCE", "Reliance Industries Ltd", "NSE", "INR",
                new BigDecimal("10"), new BigDecimal("2900.00"), new BigDecimal("29000.00"),
                new BigDecimal("3000.00"), new BigDecimal("30000.00"), new BigDecimal("1000.00"),
                new BigDecimal("3.45")
        );

        when(tradingService.getUserHoldings(eq(testUser.getId()))).thenReturn(List.of(holding));

        mockMvc.perform(get("/api/trading/holdings")
                        .header("Authorization", "Bearer " + jwtToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].symbol").value("RELIANCE"))
                .andExpect(jsonPath("$[0].quantity").value(10))
                .andExpect(jsonPath("$[0].averageBuyPrice").value(2900.00));
    }

    @Test
    @DisplayName("5. GET /api/trading/holdings/{symbol} returns holding for specific symbol")
    void testGetHoldingForSymbolEndpoint() throws Exception {
        UserHoldingDto holding = new UserHoldingDto(
                1L, "RELIANCE", "Reliance Industries Ltd", "NSE", "INR",
                new BigDecimal("10"), new BigDecimal("2900.00"), new BigDecimal("29000.00"),
                new BigDecimal("3000.00"), new BigDecimal("30000.00"), new BigDecimal("1000.00"),
                new BigDecimal("3.45")
        );

        when(tradingService.getUserHoldingForSymbol(eq(testUser.getId()), eq("RELIANCE")))
                .thenReturn(Optional.of(holding));

        mockMvc.perform(get("/api/trading/holdings/RELIANCE")
                        .header("Authorization", "Bearer " + jwtToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.symbol").value("RELIANCE"))
                .andExpect(jsonPath("$.quantity").value(10));
    }

    @Test
    @DisplayName("6. Unauthenticated requests to /api/trading endpoints return HTTP 401 Unauthorized")
    void testUnauthenticatedTradingRejected() throws Exception {
        TradeRequestDto request = new TradeRequestDto("RELIANCE", new BigDecimal("10"));

        mockMvc.perform(post("/api/trading/buy")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/trading/wallet"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/trading/holdings"))
                .andExpect(status().isUnauthorized());
    }
}
