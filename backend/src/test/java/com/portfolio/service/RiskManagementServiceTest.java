package com.portfolio.service;

import com.portfolio.dto.market.CandleDto;
import com.portfolio.dto.market.CandleSeriesDto;
import com.portfolio.dto.portfolio.PortfolioSummaryDto;
import com.portfolio.dto.risk.PortfolioRiskDto;
import com.portfolio.dto.trading.UserHoldingDto;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Collections;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RiskManagementServiceTest {

    @Mock
    private PortfolioService portfolioService;

    @Mock
    private MarketDataService marketDataService;

    @InjectMocks
    private RiskManagementService riskManagementService;

    private UserHoldingDto relianceHolding;
    private UserHoldingDto tcsHolding;

    @BeforeEach
    void setUp() {
        relianceHolding = new UserHoldingDto(
                1L, "RELIANCE", "Reliance Industries Ltd", "NSE", "INR",
                new BigDecimal("10"), new BigDecimal("2800.00"), new BigDecimal("28000.00"),
                new BigDecimal("3000.00"), new BigDecimal("30000.00"), new BigDecimal("2000.00"),
                new BigDecimal("7.14"), new BigDecimal("60.00"), true
        );

        tcsHolding = new UserHoldingDto(
                2L, "TCS", "Tata Consultancy Services Ltd", "NSE", "INR",
                new BigDecimal("5"), new BigDecimal("3800.00"), new BigDecimal("19000.00"),
                new BigDecimal("4000.00"), new BigDecimal("20000.00"), new BigDecimal("1000.00"),
                new BigDecimal("5.26"), new BigDecimal("40.00"), true
        );
    }

    @Test
    @DisplayName("1. Empty portfolio returns empty risk response with zero equity exposure")
    void testCalculateRiskEmptyPortfolio() {
        PortfolioSummaryDto emptySummary = new PortfolioSummaryDto(
                new BigDecimal("100000.00"), BigDecimal.ZERO, BigDecimal.ZERO,
                new BigDecimal("100000.00"), BigDecimal.ZERO, BigDecimal.ZERO,
                0, new BigDecimal("100.00"), Collections.emptyList()
        );

        when(portfolioService.getPortfolioSummary(1L)).thenReturn(emptySummary);

        PortfolioRiskDto result = riskManagementService.calculatePortfolioRisk(1L);

        assertThat(result).isNotNull();
        assertThat(result.emptyPortfolio()).isTrue();
        assertThat(result.exposure().cashBalance()).isEqualByComparingTo("100000.00");
        assertThat(result.exposure().equityMarketValue()).isEqualByComparingTo("0.00");
        assertThat(result.exposure().equityAllocationPercent()).isEqualByComparingTo("0.00");
        assertThat(result.exposure().cashAllocationPercent()).isEqualByComparingTo("100.00");
        assertThat(result.holdings()).isEmpty();
        assertThat(result.historicalRiskSeries()).isEmpty();
    }

    @Test
    @DisplayName("2. Active portfolio calculates concentration, HHI, and holding weights correctly")
    void testCalculateRiskConcentration() {
        // Total equity value = 50,000 (RELIANCE: 30,000 = 60%, TCS: 20,000 = 40%)
        PortfolioSummaryDto summary = new PortfolioSummaryDto(
                new BigDecimal("50000.00"), new BigDecimal("47000.00"), new BigDecimal("50000.00"),
                new BigDecimal("100000.00"), new BigDecimal("3000.00"), new BigDecimal("6.38"),
                2, new BigDecimal("50.00"), List.of(relianceHolding, tcsHolding)
        );

        when(portfolioService.getPortfolioSummary(1L)).thenReturn(summary);
        when(marketDataService.getCandles(anyString(), anyString(), anyInt())).thenReturn(null);

        PortfolioRiskDto result = riskManagementService.calculatePortfolioRisk(1L);

        assertThat(result).isNotNull();
        assertThat(result.emptyPortfolio()).isFalse();
        assertThat(result.exposure().equityMarketValue()).isEqualByComparingTo("50000.00");
        assertThat(result.exposure().cashBalance()).isEqualByComparingTo("50000.00");
        assertThat(result.exposure().totalPortfolioValue()).isEqualByComparingTo("100000.00");

        // HHI = 60^2 + 40^2 = 3600 + 1600 = 5200
        assertThat(result.herfindahlHirschmanIndex()).isEqualByComparingTo("5200.00");
        assertThat(result.top1HoldingWeightPercent()).isEqualByComparingTo("60.00");
        assertThat(result.top3HoldingWeightPercent()).isEqualByComparingTo("100.00");
        // Effective N = 1 / (0.6^2 + 0.4^2) = 1 / 0.52 = 1.92
        assertThat(result.effectiveNumberOfAssets()).isEqualByComparingTo("1.92");
        assertThat(result.diversificationRating()).isEqualTo("Highly Concentrated");

        assertThat(result.holdings()).hasSize(2);
        var relRisk = result.holdings().stream().filter(h -> h.symbol().equals("RELIANCE")).findFirst().orElseThrow();
        assertThat(relRisk.weightPercent()).isEqualByComparingTo("60.00");

        var tcsRisk = result.holdings().stream().filter(h -> h.symbol().equals("TCS")).findFirst().orElseThrow();
        assertThat(tcsRisk.weightPercent()).isEqualByComparingTo("40.00");
    }

    @Test
    @DisplayName("3. Portfolio with real historical candles calculates volatility, drawdown, and VaR")
    void testCalculateRiskWithCandles() {
        PortfolioSummaryDto summary = new PortfolioSummaryDto(
                new BigDecimal("50000.00"), new BigDecimal("47000.00"), new BigDecimal("50000.00"),
                new BigDecimal("100000.00"), new BigDecimal("3000.00"), new BigDecimal("6.38"),
                1, new BigDecimal("50.00"), List.of(relianceHolding)
        );

        List<CandleDto> relianceCandles = List.of(
                new CandleDto(1727000000L, "2026-09-20 00:00:00", new BigDecimal("2800"), new BigDecimal("2850"), new BigDecimal("2790"), new BigDecimal("2820"), 1000L),
                new CandleDto(1727086400L, "2026-09-21 00:00:00", new BigDecimal("2820"), new BigDecimal("2900"), new BigDecimal("2810"), new BigDecimal("2880"), 1000L),
                new CandleDto(1727172800L, "2026-09-22 00:00:00", new BigDecimal("2880"), new BigDecimal("2920"), new BigDecimal("2850"), new BigDecimal("2900"), 1000L),
                new CandleDto(1727259200L, "2026-09-23 00:00:00", new BigDecimal("2900"), new BigDecimal("2950"), new BigDecimal("2890"), new BigDecimal("2850"), 1000L),
                new CandleDto(1727345600L, "2026-09-24 00:00:00", new BigDecimal("2850"), new BigDecimal("3020"), new BigDecimal("2840"), new BigDecimal("3000"), 1000L)
        );

        CandleSeriesDto candleSeries = new CandleSeriesDto("RELIANCE", "1day", "INR", "NSE", "stock", relianceCandles);

        when(portfolioService.getPortfolioSummary(1L)).thenReturn(summary);
        when(marketDataService.getCandles(eq("RELIANCE"), eq("1day"), anyInt())).thenReturn(candleSeries);

        PortfolioRiskDto result = riskManagementService.calculatePortfolioRisk(1L);

        assertThat(result).isNotNull();
        assertThat(result.annualizedVolatilityPercent()).isGreaterThan(BigDecimal.ZERO);
        assertThat(result.maxDrawdownPercent()).isGreaterThanOrEqualTo(BigDecimal.ZERO);
        assertThat(result.exposure().var95DailyPercent()).isGreaterThan(BigDecimal.ZERO);
        assertThat(result.exposure().var95DailyAmount()).isGreaterThan(BigDecimal.ZERO);
        assertThat(result.historicalRiskSeries()).isNotEmpty();
        assertThat(result.holdings().get(0).dataAvailable()).isTrue();
    }

    @Test
    @DisplayName("4. User isolation - null user ID throws IllegalArgumentException")
    void testUserIsolationNull() {
        assertThatThrownBy(() -> riskManagementService.calculatePortfolioRisk(null))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
