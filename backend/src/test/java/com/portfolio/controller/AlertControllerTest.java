package com.portfolio.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.portfolio.dto.alert.AlertItemDto;
import com.portfolio.dto.alert.AlertsResponseDto;
import com.portfolio.dto.alert.CreateAlertRequest;
import com.portfolio.dto.alert.UpdateAlertRequest;
import com.portfolio.entity.User;
import com.portfolio.entity.enums.AuthProvider;
import com.portfolio.entity.enums.UserRole;
import com.portfolio.entity.enums.UserStatus;
import com.portfolio.repository.UserRepository;
import com.portfolio.security.jwt.JwtTokenProvider;
import com.portfolio.service.AlertService;
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
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class AlertControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JwtTokenProvider jwtTokenProvider;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private AlertService alertService;

    private User testUser;
    private String jwtToken;

    @BeforeEach
    void setUp() {
        userRepository.deleteAll();

        testUser = new User("alerter@example.com", "Alerter User");
        testUser.setPasswordHash("hashed_pw");
        testUser.setRole(UserRole.ROLE_USER);
        testUser.setStatus(UserStatus.ACTIVE);
        testUser.setProvider(AuthProvider.LOCAL);
        testUser = userRepository.save(testUser);

        jwtToken = jwtTokenProvider.generateToken(com.portfolio.security.UserPrincipal.create(testUser));
    }


    @Test
    @DisplayName("GET /api/alerts - requires authentication")
    void testGetAlerts_Unauthorized() throws Exception {
        mockMvc.perform(get("/api/alerts"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("GET /api/alerts - returns user alerts when authenticated")
    void testGetAlerts_Success() throws Exception {
        AlertItemDto item = new AlertItemDto(
                1L, 201L, "AAPL", "Apple Inc.", "NASDAQ", "USD",
                new BigDecimal("190.0000"), "ABOVE", "ACTIVE",
                new BigDecimal("185.0000"), true, null, null,
                System.currentTimeMillis(), System.currentTimeMillis(),
                "Twelve Data", "Target high", null
        );

        AlertsResponseDto responseDto = new AlertsResponseDto(
                List.of(item), 1, 1, 0, 0, System.currentTimeMillis()
        );

        when(alertService.getUserAlerts(testUser.getId())).thenReturn(responseDto);

        mockMvc.perform(get("/api/alerts")
                        .header("Authorization", "Bearer " + jwtToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalCount").value(1))
                .andExpect(jsonPath("$.alerts[0].symbol").value("AAPL"))
                .andExpect(jsonPath("$.alerts[0].conditionType").value("ABOVE"))
                .andExpect(jsonPath("$.alerts[0].targetPrice").value(190.0000));
    }

    @Test
    @DisplayName("POST /api/alerts - creates new alert")
    void testCreateAlert_Success() throws Exception {
        CreateAlertRequest request = new CreateAlertRequest("TSLA", "BELOW", new BigDecimal("200.0000"), "Dip buy");

        AlertItemDto item = new AlertItemDto(
                2L, 202L, "TSLA", "Tesla Inc.", "NASDAQ", "USD",
                new BigDecimal("200.0000"), "BELOW", "ACTIVE",
                new BigDecimal("210.0000"), true, null, null,
                System.currentTimeMillis(), System.currentTimeMillis(),
                "Twelve Data", "Dip buy", null
        );

        when(alertService.createAlert(eq(testUser.getId()), any(CreateAlertRequest.class))).thenReturn(item);

        mockMvc.perform(post("/api/alerts")
                        .header("Authorization", "Bearer " + jwtToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(2L))
                .andExpect(jsonPath("$.symbol").value("TSLA"))
                .andExpect(jsonPath("$.conditionType").value("BELOW"));
    }

    @Test
    @DisplayName("PUT /api/alerts/{id} - updates alert")
    void testUpdateAlert_Success() throws Exception {
        UpdateAlertRequest request = new UpdateAlertRequest("ABOVE", new BigDecimal("250.0000"), "ACTIVE", "Updated target");

        AlertItemDto item = new AlertItemDto(
                2L, 202L, "TSLA", "Tesla Inc.", "NASDAQ", "USD",
                new BigDecimal("250.0000"), "ABOVE", "ACTIVE",
                new BigDecimal("210.0000"), true, null, null,
                System.currentTimeMillis(), System.currentTimeMillis(),
                "Twelve Data", "Updated target", null
        );

        when(alertService.updateAlert(eq(testUser.getId()), eq(2L), any(UpdateAlertRequest.class))).thenReturn(item);

        mockMvc.perform(put("/api/alerts/2")
                        .header("Authorization", "Bearer " + jwtToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.targetPrice").value(250.0000));
    }

    @Test
    @DisplayName("PATCH /api/alerts/{id}/toggle - toggles alert status")
    void testToggleAlert_Success() throws Exception {
        AlertItemDto item = new AlertItemDto(
                2L, 202L, "TSLA", "Tesla Inc.", "NASDAQ", "USD",
                new BigDecimal("250.0000"), "ABOVE", "DISABLED",
                new BigDecimal("210.0000"), true, null, null,
                System.currentTimeMillis(), System.currentTimeMillis(),
                "Twelve Data", "Updated target", null
        );

        when(alertService.toggleAlertStatus(eq(testUser.getId()), eq(2L))).thenReturn(item);

        mockMvc.perform(patch("/api/alerts/2/toggle")
                        .header("Authorization", "Bearer " + jwtToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("DISABLED"));
    }

    @Test
    @DisplayName("DELETE /api/alerts/{id} - deletes alert")
    void testDeleteAlert_Success() throws Exception {
        doNothing().when(alertService).deleteAlert(testUser.getId(), 1L);

        mockMvc.perform(delete("/api/alerts/1")
                        .header("Authorization", "Bearer " + jwtToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Alert successfully deleted"));
    }
}
