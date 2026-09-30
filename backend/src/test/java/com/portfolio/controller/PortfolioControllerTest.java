package com.portfolio.controller;

import com.portfolio.dto.portfolio.PortfolioSummaryDto;
import com.portfolio.dto.trading.UserHoldingDto;
import com.portfolio.entity.User;
import com.portfolio.entity.enums.AuthProvider;
import com.portfolio.entity.enums.UserRole;
import com.portfolio.entity.enums.UserStatus;
import com.portfolio.repository.UserRepository;
import com.portfolio.security.jwt.JwtTokenProvider;
import com.portfolio.service.PortfolioService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.util.List;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class PortfolioControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JwtTokenProvider jwtTokenProvider;

    @MockBean
    private PortfolioService portfolioService;

    private User testUser;
    private String jwtToken;

    @BeforeEach
    void setUp() {
        userRepository.deleteAll();

        testUser = new User("investor@example.com", "Active Investor");
        testUser.setPasswordHash("hashed_pw");
        testUser.setRole(UserRole.ROLE_USER);
        testUser.setStatus(UserStatus.ACTIVE);
        testUser.setProvider(AuthProvider.LOCAL);
        testUser = userRepository.save(testUser);

        jwtToken = jwtTokenProvider.generateToken(com.portfolio.security.UserPrincipal.create(testUser));
    }

    @Test
    @DisplayName("1. GET /api/portfolio with JWT token returns user portfolio summary")
    void testGetPortfolioAuthenticated() throws Exception {
        UserHoldingDto holding = new UserHoldingDto(
                1L, "RELIANCE", "Reliance Industries Ltd", "NSE", "INR",
                new BigDecimal("10"), new BigDecimal("2900.00"), new BigDecimal("29000.00"),
                new BigDecimal("3000.00"), new BigDecimal("30000.00"), new BigDecimal("1000.00"),
                new BigDecimal("3.45"), new BigDecimal("30.00"), true
        );

        PortfolioSummaryDto summary = new PortfolioSummaryDto(
                new BigDecimal("70000.00"),
                new BigDecimal("29000.00"),
                new BigDecimal("30000.00"),
                new BigDecimal("100000.00"),
                new BigDecimal("1000.00"),
                new BigDecimal("3.45"),
                1,
                new BigDecimal("70.00"),
                List.of(holding)
        );

        when(portfolioService.getPortfolioSummary(eq(testUser.getId()))).thenReturn(summary);

        mockMvc.perform(get("/api/portfolio")
                        .header("Authorization", "Bearer " + jwtToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cashBalance").value(70000.00))
                .andExpect(jsonPath("$.totalInvested").value(29000.00))
                .andExpect(jsonPath("$.totalPortfolioValue").value(100000.00))
                .andExpect(jsonPath("$.totalUnrealizedPnL").value(1000.00))
                .andExpect(jsonPath("$.totalHoldingsCount").value(1))
                .andExpect(jsonPath("$.holdings[0].symbol").value("RELIANCE"))
                .andExpect(jsonPath("$.holdings[0].quantity").value(10));
    }

    @Test
    @DisplayName("2. GET /api/portfolio without JWT token returns HTTP 401 Unauthorized")
    void testGetPortfolioUnauthenticated() throws Exception {
        mockMvc.perform(get("/api/portfolio"))
                .andExpect(status().isUnauthorized());
    }
}
