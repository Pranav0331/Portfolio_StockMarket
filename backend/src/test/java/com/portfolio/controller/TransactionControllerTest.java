package com.portfolio.controller;

import com.portfolio.dto.common.PageResponseDto;
import com.portfolio.dto.transaction.TransactionDto;
import com.portfolio.entity.User;
import com.portfolio.entity.enums.AuthProvider;
import com.portfolio.entity.enums.UserRole;
import com.portfolio.entity.enums.UserStatus;
import com.portfolio.repository.UserRepository;
import com.portfolio.security.jwt.JwtTokenProvider;
import com.portfolio.service.TransactionService;
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

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class TransactionControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JwtTokenProvider jwtTokenProvider;

    @MockBean
    private TransactionService transactionService;

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
    @DisplayName("1. GET /api/transactions returns 401 when unauthenticated")
    void testUnauthenticatedAccessRejected() throws Exception {
        mockMvc.perform(get("/api/transactions"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("2. GET /api/transactions returns user transaction page when authenticated")
    void testGetTransactionsAuthenticated() throws Exception {
        TransactionDto tx = new TransactionDto(
                101L, 501L, "RELIANCE", "Reliance Industries Ltd", "NSE", "INR",
                "BUY", "EXECUTED", new BigDecimal("10"), new BigDecimal("2950.00"),
                new BigDecimal("29500.00"), BigDecimal.ZERO, Instant.parse("2026-09-30T10:00:00Z")
        );

        PageResponseDto<TransactionDto> pageResponse = new PageResponseDto<>(
                List.of(tx), 0, 15, 1, 1, true, true
        );

        when(transactionService.getUserTransactions(
                eq(testUser.getId()), isNull(), isNull(), isNull(), isNull(), eq(0), eq(15), eq("desc")
        )).thenReturn(pageResponse);

        mockMvc.perform(get("/api/transactions")
                        .header("Authorization", "Bearer " + jwtToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray())
                .andExpect(jsonPath("$.content[0].transactionId").value(101))
                .andExpect(jsonPath("$.content[0].symbol").value("RELIANCE"))
                .andExpect(jsonPath("$.content[0].type").value("BUY"))
                .andExpect(jsonPath("$.content[0].quantity").value(10))
                .andExpect(jsonPath("$.content[0].executionPrice").value(2950.00))
                .andExpect(jsonPath("$.content[0].totalAmount").value(29500.00))
                .andExpect(jsonPath("$.totalElements").value(1));
    }

    @Test
    @DisplayName("3. GET /api/transactions forwards filter parameters to service")
    void testGetTransactionsWithFilters() throws Exception {
        TransactionDto tx = new TransactionDto(
                102L, 502L, "AAPL", "Apple Inc.", "NASDAQ", "USD",
                "SELL", "EXECUTED", new BigDecimal("5"), new BigDecimal("230.00"),
                new BigDecimal("1150.00"), BigDecimal.ZERO, Instant.parse("2026-09-30T14:30:00Z")
        );

        PageResponseDto<TransactionDto> pageResponse = new PageResponseDto<>(
                List.of(tx), 0, 10, 1, 1, true, true
        );

        when(transactionService.getUserTransactions(
                eq(testUser.getId()), eq("SELL"), eq("AAPL"), any(), any(), eq(0), eq(10), eq("asc")
        )).thenReturn(pageResponse);

        mockMvc.perform(get("/api/transactions")
                        .header("Authorization", "Bearer " + jwtToken)
                        .param("type", "SELL")
                        .param("symbol", "AAPL")
                        .param("startDate", "2026-09-01")
                        .param("endDate", "2026-09-30")
                        .param("page", "0")
                        .param("size", "10")
                        .param("sort", "asc"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].symbol").value("AAPL"))
                .andExpect(jsonPath("$.content[0].type").value("SELL"));
    }
}
