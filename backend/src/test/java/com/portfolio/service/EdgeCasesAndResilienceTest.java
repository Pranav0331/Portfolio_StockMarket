package com.portfolio.service;

import com.portfolio.dto.market.StockQuoteDto;
import com.portfolio.dto.portfolio.PortfolioSummaryDto;
import com.portfolio.dto.risk.PortfolioRiskDto;
import com.portfolio.dto.trading.TradeRequestDto;
import com.portfolio.entity.User;
import com.portfolio.entity.enums.AuthProvider;
import com.portfolio.entity.enums.UserRole;
import com.portfolio.entity.enums.UserStatus;
import com.portfolio.repository.HoldingRepository;
import com.portfolio.repository.OrderRepository;
import com.portfolio.repository.TransactionRepository;
import com.portfolio.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@SpringBootTest
class EdgeCasesAndResilienceTest {

    @Autowired
    private TradingService tradingService;

    @Autowired
    private PortfolioService portfolioService;

    @Autowired
    private RiskManagementService riskManagementService;

    @Autowired
    private TransactionService transactionService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private HoldingRepository holdingRepository;

    @Autowired
    private OrderRepository orderRepository;

    @Autowired
    private TransactionRepository transactionRepository;

    @MockBean
    private MarketDataService marketDataService;

    @MockBean
    private UpstoxService upstoxService;

    private User testUser;

    @BeforeEach
    void setUp() {
        transactionRepository.deleteAll();
        orderRepository.deleteAll();
        holdingRepository.deleteAll();
        userRepository.deleteAll();

        testUser = new User("edgetester@example.com", "Edge Tester");
        testUser.setPasswordHash("hash123");
        testUser.setRole(UserRole.ROLE_USER);
        testUser.setStatus(UserStatus.ACTIVE);
        testUser.setProvider(AuthProvider.LOCAL);
        testUser = userRepository.save(testUser);

        when(upstoxService.isIndianSymbol(anyString())).thenReturn(false);
    }

    @Test
    @DisplayName("1. Empty portfolio returns correct default values without exceptions")
    void testEmptyPortfolio() {
        PortfolioSummaryDto summary = portfolioService.getPortfolioSummary(testUser.getId());
        assertNotNull(summary);
        assertEquals(0, new BigDecimal("100000.00").compareTo(summary.cashBalance()));
        assertEquals(0, BigDecimal.ZERO.compareTo(summary.totalInvested()));
        assertEquals(0, BigDecimal.ZERO.compareTo(summary.totalHoldingsMarketValue()));
        assertEquals(0, new BigDecimal("100000.00").compareTo(summary.totalPortfolioValue()));
        assertEquals(0, summary.totalHoldingsCount());
        assertTrue(summary.holdings().isEmpty());
    }

    @Test
    @DisplayName("2. Risk calculation for empty portfolio returns safe neutral indicators")
    void testEmptyPortfolioRisk() {
        PortfolioRiskDto riskDto = riskManagementService.calculatePortfolioRisk(testUser.getId());
        assertNotNull(riskDto);
        assertTrue(riskDto.emptyPortfolio());
        assertEquals(0, BigDecimal.ZERO.compareTo(riskDto.exposure().totalInvested()));
    }

    @Test
    @DisplayName("3. Selling stock when user owns zero shares throws BAD_REQUEST")
    void testSellWithoutHolding() {
        TradeRequestDto sellReq = new TradeRequestDto("AAPL", new BigDecimal("5"));
        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                tradingService.executeSell(testUser.getId(), sellReq));
        assertTrue(ex.getMessage().contains("You do not own any shares of AAPL"));
    }

    @Test
    @DisplayName("4. Selling more shares than owned throws BAD_REQUEST")
    void testSellMoreThanOwned() {
        StockQuoteDto quote = new StockQuoteDto(
                "AAPL", "Apple Inc.", new BigDecimal("200.00"),
                BigDecimal.ZERO, "0.00%", new BigDecimal("200.00"),
                new BigDecimal("200.00"), new BigDecimal("200.00"), new BigDecimal("200.00"),
                1000L, "2026-10-02", System.currentTimeMillis()
        );
        when(marketDataService.getQuote("AAPL")).thenReturn(quote);

        // Buy 5 shares
        tradingService.executeBuy(testUser.getId(), new TradeRequestDto("AAPL", new BigDecimal("5")));

        // Attempt to sell 10 shares
        TradeRequestDto sellReq = new TradeRequestDto("AAPL", new BigDecimal("10"));
        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                tradingService.executeSell(testUser.getId(), sellReq));
        assertTrue(ex.getMessage().contains("Insufficient holdings to sell"));
    }

    @Test
    @DisplayName("5. Buy then complete sell completely removes the holding from portfolio")
    void testBuyThenFullSell() {
        StockQuoteDto quote = new StockQuoteDto(
                "AAPL", "Apple Inc.", new BigDecimal("200.00"),
                BigDecimal.ZERO, "0.00%", new BigDecimal("200.00"),
                new BigDecimal("200.00"), new BigDecimal("200.00"), new BigDecimal("200.00"),
                1000L, "2026-10-02", System.currentTimeMillis()
        );
        when(marketDataService.getQuote("AAPL")).thenReturn(quote);

        // Buy 5 shares
        tradingService.executeBuy(testUser.getId(), new TradeRequestDto("AAPL", new BigDecimal("5")));
        assertEquals(1, tradingService.getUserHoldings(testUser.getId()).size());

        // Sell all 5 shares
        tradingService.executeSell(testUser.getId(), new TradeRequestDto("AAPL", new BigDecimal("5")));
        assertTrue(tradingService.getUserHoldings(testUser.getId()).isEmpty());
    }

    @Test
    @DisplayName("6. Transactions pagination handles out-of-range pages gracefully")
    void testTransactionsPagination() {
        var page = transactionService.getUserTransactions(
                testUser.getId(), null, null, null, null, 10, 10, "desc"
        );
        assertNotNull(page);
        assertEquals(0, page.totalElements());
        assertTrue(page.content().isEmpty());
    }
}
