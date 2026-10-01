package com.portfolio.service;

import com.portfolio.dto.alert.AlertItemDto;
import com.portfolio.dto.alert.AlertsResponseDto;
import com.portfolio.dto.alert.CreateAlertRequest;
import com.portfolio.dto.alert.UpdateAlertRequest;
import com.portfolio.dto.market.StockQuoteDto;
import com.portfolio.entity.Alert;
import com.portfolio.entity.Stock;
import com.portfolio.entity.User;
import com.portfolio.entity.enums.AlertCondition;
import com.portfolio.entity.enums.AlertStatus;
import com.portfolio.repository.AlertRepository;
import com.portfolio.repository.StockRepository;
import com.portfolio.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AlertServiceTest {

    @Mock
    private AlertRepository alertRepository;

    @Mock
    private StockRepository stockRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private TradingService tradingService;

    @Mock
    private UpstoxService upstoxService;

    private AlertService alertService;

    private User testUser;
    private Stock testStock;

    @BeforeEach
    void setUp() {
        alertService = new AlertService(
                alertRepository,
                stockRepository,
                userRepository,
                tradingService,
                upstoxService
        );

        testUser = new User("alertuser@example.com", "Alert User");
        testUser.setId(101L);

        testStock = new Stock("AAPL", "Apple Inc.", "NASDAQ", "USD");
        testStock.setId(201L);
        testStock.setCurrentPrice(new BigDecimal("180.0000"));
    }

    @Test
    @DisplayName("getUserAlerts - evaluates active alerts against real market prices and triggers ABOVE condition")
    void testGetUserAlerts_TriggersAboveCondition() {
        Alert alert = new Alert(testUser, testStock, new BigDecimal("185.0000"), AlertCondition.ABOVE);
        alert.setId(1L);
        alert.setStatus(AlertStatus.ACTIVE);
        alert.setCreatedAt(Instant.now());

        when(alertRepository.findByUserIdOrderByCreatedAtDesc(101L)).thenReturn(List.of(alert));
        when(tradingService.fetchRealMarketQuote("AAPL")).thenReturn(new StockQuoteDto(
                "AAPL", "Apple Inc.", new BigDecimal("190.0000"), new BigDecimal("5.0000"), "+2.70%",
                new BigDecimal("185.0000"), new BigDecimal("186.0000"), new BigDecimal("192.0000"), new BigDecimal("184.0000"),
                1000000L, "2026-10-01", System.currentTimeMillis() / 1000
        ));

        AlertsResponseDto response = alertService.getUserAlerts(101L);

        assertThat(response.totalCount()).isEqualTo(1);
        assertThat(response.triggeredCount()).isEqualTo(1);
        assertThat(alert.getStatus()).isEqualTo(AlertStatus.TRIGGERED);
        assertThat(alert.getTriggeredPrice()).isEqualByComparingTo("190.0000");
        verify(alertRepository).save(alert);
    }

    @Test
    @DisplayName("getUserAlerts - evaluates active alerts against real market prices and triggers BELOW condition")
    void testGetUserAlerts_TriggersBelowCondition() {
        Alert alert = new Alert(testUser, testStock, new BigDecimal("175.0000"), AlertCondition.BELOW);
        alert.setId(2L);
        alert.setStatus(AlertStatus.ACTIVE);
        alert.setCreatedAt(Instant.now());

        when(alertRepository.findByUserIdOrderByCreatedAtDesc(101L)).thenReturn(List.of(alert));
        when(tradingService.fetchRealMarketQuote("AAPL")).thenReturn(new StockQuoteDto(
                "AAPL", "Apple Inc.", new BigDecimal("170.0000"), new BigDecimal("-10.0000"), "-5.55%",
                new BigDecimal("180.0000"), new BigDecimal("179.0000"), new BigDecimal("182.0000"), new BigDecimal("169.0000"),
                1000000L, "2026-10-01", System.currentTimeMillis() / 1000
        ));

        AlertsResponseDto response = alertService.getUserAlerts(101L);

        assertThat(response.totalCount()).isEqualTo(1);
        assertThat(response.triggeredCount()).isEqualTo(1);
        assertThat(alert.getStatus()).isEqualTo(AlertStatus.TRIGGERED);
        assertThat(alert.getTriggeredPrice()).isEqualByComparingTo("170.0000");
        verify(alertRepository).save(alert);
    }

    @Test
    @DisplayName("getUserAlerts - active alert remains ACTIVE when condition is not met")
    void testGetUserAlerts_ConditionNotMet() {
        Alert alert = new Alert(testUser, testStock, new BigDecimal("200.0000"), AlertCondition.ABOVE);
        alert.setId(3L);
        alert.setStatus(AlertStatus.ACTIVE);
        alert.setCreatedAt(Instant.now());

        when(alertRepository.findByUserIdOrderByCreatedAtDesc(101L)).thenReturn(List.of(alert));
        when(tradingService.fetchRealMarketQuote("AAPL")).thenReturn(new StockQuoteDto(
                "AAPL", "Apple Inc.", new BigDecimal("180.0000"), BigDecimal.ZERO, "0.00%",
                new BigDecimal("180.0000"), new BigDecimal("180.0000"), new BigDecimal("185.0000"), new BigDecimal("178.0000"),
                1000000L, "2026-10-01", System.currentTimeMillis() / 1000
        ));


        AlertsResponseDto response = alertService.getUserAlerts(101L);

        assertThat(response.activeCount()).isEqualTo(1);
        assertThat(response.triggeredCount()).isEqualTo(0);
        assertThat(alert.getStatus()).isEqualTo(AlertStatus.ACTIVE);
        verify(alertRepository, never()).save(alert);
    }

    @Test
    @DisplayName("getUserAlerts - handles unavailable market data gracefully without inventing prices")
    void testGetUserAlerts_UnavailableMarketData() {
        Alert alert = new Alert(testUser, testStock, new BigDecimal("200.0000"), AlertCondition.ABOVE);
        alert.setId(4L);
        alert.setStatus(AlertStatus.ACTIVE);
        alert.setCreatedAt(Instant.now());

        when(alertRepository.findByUserIdOrderByCreatedAtDesc(101L)).thenReturn(List.of(alert));
        when(tradingService.fetchRealMarketQuote("AAPL")).thenThrow(new RuntimeException("Upstream timeout"));

        AlertsResponseDto response = alertService.getUserAlerts(101L);

        assertThat(response.alerts()).hasSize(1);
        AlertItemDto item = response.alerts().get(0);
        assertThat(item.priceAvailable()).isFalse();
        assertThat(item.currentPrice()).isNull();
        assertThat(item.message()).isEqualTo("Market data unavailable");
        assertThat(alert.getStatus()).isEqualTo(AlertStatus.ACTIVE);
    }

    @Test
    @DisplayName("createAlert - creates new alert with validation and duplicate prevention")
    void testCreateAlert_Success() {
        CreateAlertRequest request = new CreateAlertRequest("AAPL", "ABOVE", new BigDecimal("195.0000"), "Take profit");

        when(userRepository.findById(101L)).thenReturn(Optional.of(testUser));
        when(alertRepository.existsByUserIdAndStockSymbolAndConditionTypeAndTargetPriceAndStatus(
                101L, "AAPL", AlertCondition.ABOVE, new BigDecimal("195.0000"), AlertStatus.ACTIVE
        )).thenReturn(false);
        when(stockRepository.findBySymbol("AAPL")).thenReturn(Optional.of(testStock));
        when(tradingService.fetchRealMarketQuote("AAPL")).thenReturn(new StockQuoteDto(
                "AAPL", "Apple Inc.", new BigDecimal("182.0000"), new BigDecimal("2.0000"), "+1.10%",
                new BigDecimal("180.0000"), new BigDecimal("180.0000"), new BigDecimal("183.0000"), new BigDecimal("180.0000"),
                1000000L, "2026-10-01", System.currentTimeMillis() / 1000
        ));

        when(alertRepository.save(any(Alert.class))).thenAnswer(invocation -> {
            Alert a = invocation.getArgument(0);
            a.setId(10L);
            a.setCreatedAt(Instant.now());
            return a;
        });

        AlertItemDto result = alertService.createAlert(101L, request);

        assertThat(result.id()).isEqualTo(10L);
        assertThat(result.symbol()).isEqualTo("AAPL");
        assertThat(result.conditionType()).isEqualTo("ABOVE");
        assertThat(result.targetPrice()).isEqualByComparingTo("195.0000");
        assertThat(result.status()).isEqualTo("ACTIVE");
    }

    @Test
    @DisplayName("createAlert - throws 409 CONFLICT on duplicate active alert")
    void testCreateAlert_DuplicateConflict() {
        CreateAlertRequest request = new CreateAlertRequest("AAPL", "ABOVE", new BigDecimal("195.0000"), null);

        when(userRepository.findById(101L)).thenReturn(Optional.of(testUser));
        when(alertRepository.existsByUserIdAndStockSymbolAndConditionTypeAndTargetPriceAndStatus(
                101L, "AAPL", AlertCondition.ABOVE, new BigDecimal("195.0000"), AlertStatus.ACTIVE
        )).thenReturn(true);

        assertThatThrownBy(() -> alertService.createAlert(101L, request))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("already exists");
    }

    @Test
    @DisplayName("updateAlert - enforces user ownership and throws 404 for unauthorized alert id")
    void testUpdateAlert_UserIsolation() {
        UpdateAlertRequest request = new UpdateAlertRequest("BELOW", new BigDecimal("150.0000"), "ACTIVE", "Updated note");

        when(alertRepository.findByIdAndUserId(999L, 101L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> alertService.updateAlert(101L, 999L, request))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Alert not found or does not belong to user");
    }

    @Test
    @DisplayName("toggleAlertStatus - toggles ACTIVE to DISABLED")
    void testToggleAlertStatus() {
        Alert alert = new Alert(testUser, testStock, new BigDecimal("200.0000"), AlertCondition.ABOVE);
        alert.setId(5L);
        alert.setStatus(AlertStatus.ACTIVE);
        alert.setCreatedAt(Instant.now());

        when(alertRepository.findByIdAndUserId(5L, 101L)).thenReturn(Optional.of(alert));
        when(alertRepository.save(any(Alert.class))).thenReturn(alert);

        AlertItemDto result = alertService.toggleAlertStatus(101L, 5L);

        assertThat(alert.getStatus()).isEqualTo(AlertStatus.DISABLED);
        assertThat(result.status()).isEqualTo("DISABLED");
    }

    @Test
    @DisplayName("deleteAlert - deletes alert when user owns it")
    void testDeleteAlert_Success() {
        Alert alert = new Alert(testUser, testStock, new BigDecimal("200.0000"), AlertCondition.ABOVE);
        alert.setId(6L);

        when(alertRepository.findByIdAndUserId(6L, 101L)).thenReturn(Optional.of(alert));

        alertService.deleteAlert(101L, 6L);

        verify(alertRepository).delete(alert);
    }
}
