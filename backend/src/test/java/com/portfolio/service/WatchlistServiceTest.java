package com.portfolio.service;

import com.portfolio.dto.market.StockQuoteDto;
import com.portfolio.dto.watchlist.AddWatchlistRequest;
import com.portfolio.dto.watchlist.ReorderWatchlistRequest;
import com.portfolio.dto.watchlist.WatchlistItemDto;
import com.portfolio.dto.watchlist.WatchlistResponseDto;
import com.portfolio.entity.Stock;
import com.portfolio.entity.User;
import com.portfolio.entity.Watchlist;
import com.portfolio.repository.StockRepository;
import com.portfolio.repository.UserRepository;
import com.portfolio.repository.WatchlistRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class WatchlistServiceTest {

    @Mock
    private WatchlistRepository watchlistRepository;

    @Mock
    private StockRepository stockRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private TradingService tradingService;

    @Mock
    private UpstoxService upstoxService;

    @InjectMocks
    private WatchlistService watchlistService;

    private User testUser;
    private Stock relianceStock;
    private Stock aaplStock;

    @BeforeEach
    void setUp() {
        testUser = new User("trader@example.com", "Active Trader");
        testUser.setId(1L);

        relianceStock = new Stock("RELIANCE", "Reliance Industries Ltd", "NSE", "INR");
        relianceStock.setId(10L);
        relianceStock.setCurrentPrice(new BigDecimal("3000.00"));

        aaplStock = new Stock("AAPL", "Apple Inc.", "NASDAQ", "USD");
        aaplStock.setId(20L);
        aaplStock.setCurrentPrice(new BigDecimal("225.00"));
    }

    @Test
    @DisplayName("1. Empty watchlist returns clean response with 0 items")
    void testGetEmptyWatchlist() {
        when(watchlistRepository.findByUserIdOrderByDisplayOrderAscCreatedAtAsc(1L)).thenReturn(Collections.emptyList());

        WatchlistResponseDto response = watchlistService.getUserWatchlist(1L);

        assertThat(response).isNotNull();
        assertThat(response.totalCount()).isEqualTo(0);
        assertThat(response.items()).isEmpty();
        assertThat(response.categories()).containsExactly("INDICES", "STOCKS", "FOREX", "CRYPTO");
    }

    @Test
    @DisplayName("2. User watchlist enriches items with real-time live prices")
    void testGetWatchlistWithLivePrices() {
        Watchlist w1 = new Watchlist(testUser, relianceStock, "STOCKS", 0);
        w1.setId(101L);

        StockQuoteDto quote = new StockQuoteDto(
                "RELIANCE", "Reliance Industries Ltd", new BigDecimal("3050.00"),
                new BigDecimal("50.00"), "+1.67%", new BigDecimal("3000.00"),
                new BigDecimal("3000.00"), new BigDecimal("3060.00"), new BigDecimal("2990.00"),
                100000L, "2026-10-01", 1727780000L
        );

        when(watchlistRepository.findByUserIdOrderByDisplayOrderAscCreatedAtAsc(1L)).thenReturn(List.of(w1));
        when(tradingService.fetchRealMarketQuote("RELIANCE")).thenReturn(quote);

        WatchlistResponseDto response = watchlistService.getUserWatchlist(1L);

        assertThat(response.totalCount()).isEqualTo(1);
        WatchlistItemDto item = response.items().get(0);
        assertThat(item.symbol()).isEqualTo("RELIANCE");
        assertThat(item.currentPrice()).isEqualByComparingTo("3050.00");
        assertThat(item.change()).isEqualByComparingTo("50.00");
        assertThat(item.changePercent()).isEqualTo("+1.67%");
        assertThat(item.priceAvailable()).isTrue();
    }

    @Test
    @DisplayName("3. Adding a symbol persists it in database and prevents duplicates")
    void testAddToWatchlist() {
        AddWatchlistRequest request = new AddWatchlistRequest("AAPL", "STOCKS", "My tech stock");

        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser));
        when(watchlistRepository.existsByUserIdAndSymbol(1L, "AAPL")).thenReturn(false);
        when(stockRepository.findBySymbol("AAPL")).thenReturn(Optional.of(aaplStock));
        when(watchlistRepository.findByUserIdOrderByDisplayOrderAscCreatedAtAsc(1L)).thenReturn(Collections.emptyList());

        Watchlist savedWatchlist = new Watchlist(testUser, aaplStock, "STOCKS", 0);
        savedWatchlist.setId(201L);
        when(watchlistRepository.save(any(Watchlist.class))).thenReturn(savedWatchlist);

        StockQuoteDto aaplQuote = new StockQuoteDto(
                "AAPL", "Apple Inc.", new BigDecimal("230.00"),
                new BigDecimal("5.00"), "+2.22%", new BigDecimal("225.00"),
                new BigDecimal("226.00"), new BigDecimal("231.00"), new BigDecimal("224.00"),
                500000L, "2026-10-01", 1727780000L
        );
        when(tradingService.fetchRealMarketQuote("AAPL")).thenReturn(aaplQuote);

        WatchlistItemDto item = watchlistService.addToWatchlist(1L, request);

        assertThat(item).isNotNull();
        assertThat(item.symbol()).isEqualTo("AAPL");
        assertThat(item.category()).isEqualTo("STOCKS");
        verify(watchlistRepository, times(1)).save(any(Watchlist.class));
    }

    @Test
    @DisplayName("4. Adding duplicate symbol throws HTTP 409 Conflict")
    void testAddDuplicateSymbolThrowsConflict() {
        AddWatchlistRequest request = new AddWatchlistRequest("RELIANCE", "STOCKS", null);

        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser));
        when(watchlistRepository.existsByUserIdAndSymbol(1L, "RELIANCE")).thenReturn(true);

        assertThatThrownBy(() -> watchlistService.addToWatchlist(1L, request))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("already in your watchlist");
    }

    @Test
    @DisplayName("5. Removing item from watchlist by ID enforeces user ownership")
    void testRemoveFromWatchlist() {
        Watchlist w = new Watchlist(testUser, relianceStock, "STOCKS", 0);
        w.setId(101L);

        when(watchlistRepository.findByIdAndUserId(101L, 1L)).thenReturn(Optional.of(w));

        watchlistService.removeFromWatchlist(1L, 101L);

        verify(watchlistRepository, times(1)).delete(w);
    }

    @Test
    @DisplayName("6. Removing non-existent or unowned item throws HTTP 404 Not Found")
    void testRemoveUnownedThrowsNotFound() {
        when(watchlistRepository.findByIdAndUserId(999L, 1L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> watchlistService.removeFromWatchlist(1L, 999L))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    @DisplayName("7. Category auto-detection categorizes symbols correctly")
    void testCategoryAutoDetection() {
        assertThat(watchlistService.detectCategory("NIFTY 50")).isEqualTo("INDICES");
        assertThat(watchlistService.detectCategory("SPY")).isEqualTo("INDICES");
        assertThat(watchlistService.detectCategory("EUR/USD")).isEqualTo("FOREX");
        assertThat(watchlistService.detectCategory("BTC/USD")).isEqualTo("CRYPTO");
        assertThat(watchlistService.detectCategory("AAPL")).isEqualTo("STOCKS");
    }

    @Test
    @DisplayName("8. Reordering watchlist persists updated displayOrder indices")
    void testReorderWatchlist() {
        Watchlist w1 = new Watchlist(testUser, relianceStock, "STOCKS", 0);
        w1.setId(101L);
        Watchlist w2 = new Watchlist(testUser, aaplStock, "STOCKS", 1);
        w2.setId(102L);

        when(watchlistRepository.findByUserId(1L)).thenReturn(List.of(w1, w2));

        ReorderWatchlistRequest req = new ReorderWatchlistRequest(List.of(102L, 101L));
        watchlistService.reorderWatchlist(1L, req);

        assertThat(w2.getDisplayOrder()).isEqualTo(0);
        assertThat(w1.getDisplayOrder()).isEqualTo(1);
        verify(watchlistRepository, times(2)).save(any(Watchlist.class));
    }
}
