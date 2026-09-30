package com.portfolio.service;

import com.portfolio.dto.market.StockQuoteDto;
import com.portfolio.dto.portfolio.PortfolioSummaryDto;
import com.portfolio.entity.Holding;
import com.portfolio.entity.Stock;
import com.portfolio.entity.User;
import com.portfolio.repository.HoldingRepository;
import com.portfolio.repository.StockRepository;
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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PortfolioServiceTest {

    @Mock
    private HoldingRepository holdingRepository;

    @Mock
    private StockRepository stockRepository;

    @Mock
    private TradingService tradingService;

    @InjectMocks
    private PortfolioService portfolioService;

    private User testUser;
    private Stock relianceStock;
    private Stock aaplStock;

    @BeforeEach
    void setUp() {
        testUser = new User("investor@example.com", "John Doe");
        testUser.setId(1L);

        relianceStock = new Stock("RELIANCE", "Reliance Industries Ltd", "NSE", "INR");
        relianceStock.setId(10L);
        relianceStock.setCurrentPrice(new BigDecimal("2950.0000"));

        aaplStock = new Stock("AAPL", "Apple Inc.", "NASDAQ", "USD");
        aaplStock.setId(20L);
        aaplStock.setCurrentPrice(new BigDecimal("225.0000"));
    }

    @Test
    @DisplayName("1. Empty portfolio returns initial virtual cash balance and zero metrics")
    void testGetPortfolioSummaryEmpty() {
        when(tradingService.calculateCashBalance(1L)).thenReturn(new BigDecimal("100000.0000"));
        when(holdingRepository.findByUserId(1L)).thenReturn(Collections.emptyList());

        PortfolioSummaryDto summary = portfolioService.getPortfolioSummary(1L);

        assertThat(summary).isNotNull();
        assertThat(summary.cashBalance()).isEqualByComparingTo("100000.00");
        assertThat(summary.totalInvested()).isEqualByComparingTo("0.00");
        assertThat(summary.totalHoldingsMarketValue()).isEqualByComparingTo("0.00");
        assertThat(summary.totalPortfolioValue()).isEqualByComparingTo("100000.00");
        assertThat(summary.totalUnrealizedPnL()).isEqualByComparingTo("0.00");
        assertThat(summary.totalHoldingsCount()).isEqualTo(0);
        assertThat(summary.cashAllocationPercent()).isEqualByComparingTo("100.00");
        assertThat(summary.holdings()).isEmpty();
    }

    @Test
    @DisplayName("2. Portfolio with active holdings calculates invested, market value, PnL, and allocations correctly")
    void testGetPortfolioSummaryWithHoldings() {
        Holding h1 = new Holding(testUser, relianceStock, new BigDecimal("10"), new BigDecimal("2900.0000"), new BigDecimal("29000.0000"));
        h1.setId(100L);

        Holding h2 = new Holding(testUser, aaplStock, new BigDecimal("20"), new BigDecimal("200.0000"), new BigDecimal("4000.0000"));
        h2.setId(101L);

        // Real market prices: RELIANCE = 3000 (+1000 profit), AAPL = 230 (+600 profit)
        StockQuoteDto relianceQuote = new StockQuoteDto(
                "RELIANCE", "Reliance Industries Ltd", new BigDecimal("3000.0000"),
                BigDecimal.ZERO, "0%", BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, 1000L, "2026-09-30", 1727690000L
        );
        StockQuoteDto aaplQuote = new StockQuoteDto(
                "AAPL", "Apple Inc.", new BigDecimal("230.0000"),
                BigDecimal.ZERO, "0%", BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, 1000L, "2026-09-30", 1727690000L
        );

        when(tradingService.calculateCashBalance(1L)).thenReturn(new BigDecimal("67000.0000"));
        when(holdingRepository.findByUserId(1L)).thenReturn(List.of(h1, h2));
        when(tradingService.fetchRealMarketQuote("RELIANCE")).thenReturn(relianceQuote);
        when(tradingService.fetchRealMarketQuote("AAPL")).thenReturn(aaplQuote);

        PortfolioSummaryDto summary = portfolioService.getPortfolioSummary(1L);

        assertThat(summary).isNotNull();
        assertThat(summary.cashBalance()).isEqualByComparingTo("67000.00");
        assertThat(summary.totalInvested()).isEqualByComparingTo("33000.00"); // 29000 + 4000
        assertThat(summary.totalHoldingsMarketValue()).isEqualByComparingTo("34600.00"); // (10 * 3000) + (20 * 230) = 30000 + 4600
        assertThat(summary.totalPortfolioValue()).isEqualByComparingTo("101600.00"); // 67000 + 34600
        assertThat(summary.totalUnrealizedPnL()).isEqualByComparingTo("1600.00"); // 34600 - 33000
        assertThat(summary.totalUnrealizedPnLPercent()).isEqualByComparingTo("4.85"); // (1600 / 33000) * 100 = 4.848% -> 4.85%
        assertThat(summary.totalHoldingsCount()).isEqualTo(2);

        // Check Individual Holdings Calculations
        var relDto = summary.holdings().stream().filter(h -> h.symbol().equals("RELIANCE")).findFirst().orElseThrow();
        assertThat(relDto.quantity()).isEqualByComparingTo("10");
        assertThat(relDto.averageBuyPrice()).isEqualByComparingTo("2900.00");
        assertThat(relDto.currentPrice()).isEqualByComparingTo("3000.00");
        assertThat(relDto.currentValue()).isEqualByComparingTo("30000.00");
        assertThat(relDto.unrealizedPnL()).isEqualByComparingTo("1000.00");
        assertThat(relDto.unrealizedPnLPercent()).isEqualByComparingTo("3.45"); // (1000 / 29000) * 100
        assertThat(relDto.priceAvailable()).isTrue();

        var aaplDto = summary.holdings().stream().filter(h -> h.symbol().equals("AAPL")).findFirst().orElseThrow();
        assertThat(aaplDto.quantity()).isEqualByComparingTo("20");
        assertThat(aaplDto.averageBuyPrice()).isEqualByComparingTo("200.00");
        assertThat(aaplDto.currentPrice()).isEqualByComparingTo("230.00");
        assertThat(aaplDto.currentValue()).isEqualByComparingTo("4600.00");
        assertThat(aaplDto.unrealizedPnL()).isEqualByComparingTo("600.00");
        assertThat(aaplDto.unrealizedPnLPercent()).isEqualByComparingTo("15.00"); // (600 / 4000) * 100
        assertThat(aaplDto.priceAvailable()).isTrue();
    }

    @Test
    @DisplayName("3. Unavailable real market price is handled safely without throwing exceptions")
    void testGetPortfolioSummaryPriceUnavailable() {
        Holding h = new Holding(testUser, relianceStock, new BigDecimal("10"), new BigDecimal("2900.0000"), new BigDecimal("29000.0000"));

        when(tradingService.calculateCashBalance(1L)).thenReturn(new BigDecimal("71000.0000"));
        when(holdingRepository.findByUserId(1L)).thenReturn(List.of(h));
        when(tradingService.fetchRealMarketQuote("RELIANCE")).thenReturn(null); // Real price unavailable

        PortfolioSummaryDto summary = portfolioService.getPortfolioSummary(1L);

        assertThat(summary).isNotNull();
        assertThat(summary.totalHoldingsCount()).isEqualTo(1);
        var dto = summary.holdings().get(0);
        assertThat(dto.priceAvailable()).isFalse();
        assertThat(dto.currentPrice()).isEqualByComparingTo("2950.0000"); // fallback to last known stock price
    }

    @Test
    @DisplayName("4. User isolation - returns only requested user's holdings")
    void testUserIsolation() {
        when(tradingService.calculateCashBalance(1L)).thenReturn(new BigDecimal("100000.0000"));
        when(holdingRepository.findByUserId(1L)).thenReturn(Collections.emptyList());

        PortfolioSummaryDto userSummary = portfolioService.getPortfolioSummary(1L);

        assertThat(userSummary.holdings()).isEmpty();
    }
}
