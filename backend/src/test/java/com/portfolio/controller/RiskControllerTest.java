package com.portfolio.controller;

import com.portfolio.dto.risk.HistoricalRiskPointDto;
import com.portfolio.dto.risk.HoldingRiskDto;
import com.portfolio.dto.risk.PortfolioRiskDto;
import com.portfolio.dto.risk.RiskExposureDto;
import com.portfolio.entity.User;
import com.portfolio.entity.enums.AuthProvider;
import com.portfolio.entity.enums.UserRole;
import com.portfolio.entity.enums.UserStatus;
import com.portfolio.repository.UserRepository;
import com.portfolio.security.jwt.JwtTokenProvider;
import com.portfolio.service.RiskManagementService;
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
class RiskControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JwtTokenProvider jwtTokenProvider;

    @MockBean
    private RiskManagementService riskManagementService;

    private User testUser;
    private String jwtToken;

    @BeforeEach
    void setUp() {
        userRepository.deleteAll();

        testUser = new User("riskuser@example.com", "Risk Analyst");
        testUser.setPasswordHash("hashed_password");
        testUser.setRole(UserRole.ROLE_USER);
        testUser.setStatus(UserStatus.ACTIVE);
        testUser.setProvider(AuthProvider.LOCAL);
        testUser = userRepository.save(testUser);

        jwtToken = jwtTokenProvider.generateToken(com.portfolio.security.UserPrincipal.create(testUser));
    }

    @Test
    @DisplayName("1. GET /api/portfolio/risk with JWT token returns risk analysis")
    void testGetPortfolioRiskAuthenticated() throws Exception {
        RiskExposureDto exposure = new RiskExposureDto(
                new BigDecimal("50000.00"),
                new BigDecimal("55000.00"),
                new BigDecimal("45000.00"),
                new BigDecimal("100000.00"),
                new BigDecimal("55.00"),
                new BigDecimal("45.00"),
                new BigDecimal("1250.00"),
                new BigDecimal("2.27")
        );

        HoldingRiskDto holding = new HoldingRiskDto(
                1L, "RELIANCE", "Reliance Industries Ltd", "NSE", "INR",
                new BigDecimal("10"), new BigDecimal("3000.00"), new BigDecimal("30000.00"),
                new BigDecimal("54.55"), new BigDecimal("18.50"), new BigDecimal("4.20"),
                new BigDecimal("680.00"), new BigDecimal("2000.00"), new BigDecimal("7.14"),
                "Low Risk", true
        );

        HistoricalRiskPointDto historyPt = new HistoricalRiskPointDto(
                1727000000L, "2026-09-20", new BigDecimal("100.00"), new BigDecimal("0.00"), new BigDecimal("15.20")
        );

        PortfolioRiskDto riskDto = new PortfolioRiskDto(
                exposure,
                new BigDecimal("18.50"),
                new BigDecimal("4.20"),
                new BigDecimal("3500.00"),
                new BigDecimal("54.55"),
                new BigDecimal("100.00"),
                new BigDecimal("1.83"),
                "Moderately Concentrated",
                new BigDecimal("0.95"),
                "NIFTY 50",
                true,
                List.of(holding),
                List.of(historyPt),
                System.currentTimeMillis(),
                "Real Market Data",
                false,
                true,
                "Success"
        );

        when(riskManagementService.calculatePortfolioRisk(eq(testUser.getId()))).thenReturn(riskDto);

        mockMvc.perform(get("/api/portfolio/risk")
                        .header("Authorization", "Bearer " + jwtToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.exposure.equityMarketValue").value(55000.00))
                .andExpect(jsonPath("$.exposure.cashBalance").value(45000.00))
                .andExpect(jsonPath("$.annualizedVolatilityPercent").value(18.50))
                .andExpect(jsonPath("$.maxDrawdownPercent").value(4.20))
                .andExpect(jsonPath("$.diversificationRating").value("Moderately Concentrated"))
                .andExpect(jsonPath("$.holdings[0].symbol").value("RELIANCE"))
                .andExpect(jsonPath("$.holdings[0].riskRating").value("Low Risk"));
    }

    @Test
    @DisplayName("2. GET /api/portfolio/risk without JWT token returns HTTP 401 Unauthorized")
    void testGetPortfolioRiskUnauthenticated() throws Exception {
        mockMvc.perform(get("/api/portfolio/risk"))
                .andExpect(status().isUnauthorized());
    }
}
