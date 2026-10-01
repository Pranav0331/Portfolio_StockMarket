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
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class WatchlistService {

    private static final Logger log = LoggerFactory.getLogger(WatchlistService.class);

    private final WatchlistRepository watchlistRepository;
    private final StockRepository stockRepository;
    private final UserRepository userRepository;
    private final TradingService tradingService;
    private final UpstoxService upstoxService;

    public WatchlistService(
            WatchlistRepository watchlistRepository,
            StockRepository stockRepository,
            UserRepository userRepository,
            TradingService tradingService,
            @org.springframework.beans.factory.annotation.Autowired(required = false) UpstoxService upstoxService
    ) {
        this.watchlistRepository = watchlistRepository;
        this.stockRepository = stockRepository;
        this.userRepository = userRepository;
        this.tradingService = tradingService;
        this.upstoxService = upstoxService;
    }

    @Transactional
    public WatchlistResponseDto getUserWatchlist(Long userId) {
        if (userId == null) {
            throw new IllegalArgumentException("User ID is required");
        }

        List<Watchlist> entries = watchlistRepository.findByUserIdOrderByDisplayOrderAscCreatedAtAsc(userId);
        List<WatchlistItemDto> items = new ArrayList<>();

        for (Watchlist w : entries) {
            Stock stock = w.getStock();
            String symbol = stock != null ? stock.getSymbol() : "UNKNOWN";
            String category = normalizeCategory(w.getCategory(), symbol);

            BigDecimal currentPrice = null;
            BigDecimal change = null;
            String changePercent = null;
            BigDecimal prevClose = stock != null ? stock.getPreviousClose() : null;
            Long volume = null;
            Long lastUpdated = System.currentTimeMillis();
            boolean priceAvailable = false;
            String provider = detectProvider(symbol);

            try {
                StockQuoteDto quote = tradingService.fetchRealMarketQuote(symbol);
                if (quote != null && quote.price() != null && quote.price().compareTo(BigDecimal.ZERO) > 0) {
                    currentPrice = quote.price();
                    change = quote.change();
                    changePercent = quote.changePercent();
                    if (quote.previousClose() != null) {
                        prevClose = quote.previousClose();
                    }
                    volume = quote.volume();
                    if (quote.timestamp() != null) {
                        lastUpdated = quote.timestamp() * 1000;
                    }
                    priceAvailable = true;

                    // Update stock entity if price found
                    if (stock != null) {
                        stock.setCurrentPrice(currentPrice);
                        if (prevClose != null) {
                            stock.setPreviousClose(prevClose);
                        }
                        stockRepository.save(stock);
                    }
                }
            } catch (Exception e) {
                log.warn("Could not fetch live market price for watchlist item {}: {}", symbol, e.getMessage());
            }

            if (!priceAvailable && stock != null && stock.getCurrentPrice() != null) {
                currentPrice = stock.getCurrentPrice();
            }

            items.add(new WatchlistItemDto(
                    w.getId(),
                    stock != null ? stock.getId() : null,
                    symbol,
                    stock != null ? stock.getCompanyName() : symbol,
                    stock != null ? stock.getExchange() : "NSE",
                    stock != null ? stock.getCurrency() : "USD",
                    category,
                    currentPrice,
                    change,
                    changePercent,
                    prevClose,
                    volume,
                    w.getDisplayOrder(),
                    priceAvailable,
                    lastUpdated,
                    provider,
                    w.getNotes()
            ));
        }

        List<String> categories = List.of("INDICES", "STOCKS", "FOREX", "CRYPTO");

        return new WatchlistResponseDto(
                items,
                categories,
                items.size(),
                System.currentTimeMillis()
        );
    }

    @Transactional
    public WatchlistItemDto addToWatchlist(Long userId, AddWatchlistRequest request) {
        if (userId == null) {
            throw new IllegalArgumentException("User ID is required");
        }
        if (request == null || request.symbol() == null || request.symbol().trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Symbol parameter is required");
        }

        String cleanSymbol = request.symbol().trim().toUpperCase(Locale.ROOT);

        // Check if user exists
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));

        // Duplicate prevention
        if (watchlistRepository.existsByUserIdAndSymbol(userId, cleanSymbol)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Symbol " + cleanSymbol + " is already in your watchlist");
        }

        // Detect category & provider
        String category = request.category() != null && !request.category().trim().isEmpty()
                ? request.category().trim().toUpperCase(Locale.ROOT)
                : detectCategory(cleanSymbol);
        String provider = detectProvider(cleanSymbol);

        // Fetch or create stock entity
        Stock stock = stockRepository.findBySymbol(cleanSymbol).orElse(null);
        BigDecimal currentPrice = null;
        BigDecimal change = null;
        String changePercent = null;
        BigDecimal prevClose = null;
        Long volume = null;
        Long lastUpdated = System.currentTimeMillis();
        boolean priceAvailable = false;

        try {
            StockQuoteDto quote = tradingService.fetchRealMarketQuote(cleanSymbol);
            if (quote != null && quote.price() != null) {
                currentPrice = quote.price();
                change = quote.change();
                changePercent = quote.changePercent();
                prevClose = quote.previousClose();
                volume = quote.volume();
                if (quote.timestamp() != null) {
                    lastUpdated = quote.timestamp() * 1000;
                }
                priceAvailable = true;

                if (stock == null) {
                    String name = quote.name() != null ? quote.name() : cleanSymbol;
                    String exchange = detectExchange(cleanSymbol);
                    String currency = detectCurrency(cleanSymbol);
                    stock = new Stock(cleanSymbol, name, exchange, currency);
                    stock.setCurrentPrice(currentPrice);
                    stock.setPreviousClose(prevClose);
                    stock = stockRepository.save(stock);
                } else {
                    stock.setCurrentPrice(currentPrice);
                    if (prevClose != null) {
                        stock.setPreviousClose(prevClose);
                    }
                    stockRepository.save(stock);
                }
            }
        } catch (Exception e) {
            log.warn("Could not fetch real quote for newly added symbol {}: {}", cleanSymbol, e.getMessage());
        }

        if (stock == null) {
            String exchange = detectExchange(cleanSymbol);
            String currency = detectCurrency(cleanSymbol);
            stock = new Stock(cleanSymbol, cleanSymbol, exchange, currency);
            stock = stockRepository.save(stock);
        }

        // Determine next display order
        List<Watchlist> currentList = watchlistRepository.findByUserIdOrderByDisplayOrderAscCreatedAtAsc(userId);
        int nextOrder = currentList.isEmpty() ? 0 : currentList.get(currentList.size() - 1).getDisplayOrder() + 1;

        Watchlist watchlist = new Watchlist(user, stock, category, nextOrder);
        if (request.notes() != null) {
            watchlist.setNotes(request.notes().trim());
        }
        watchlist = watchlistRepository.save(watchlist);

        return new WatchlistItemDto(
                watchlist.getId(),
                stock.getId(),
                cleanSymbol,
                stock.getCompanyName(),
                stock.getExchange(),
                stock.getCurrency(),
                category,
                currentPrice,
                change,
                changePercent,
                prevClose,
                volume,
                watchlist.getDisplayOrder(),
                priceAvailable,
                lastUpdated,
                provider,
                watchlist.getNotes()
        );
    }

    @Transactional
    public void removeFromWatchlist(Long userId, Long watchlistId) {
        if (userId == null || watchlistId == null) {
            throw new IllegalArgumentException("User ID and Watchlist ID are required");
        }

        Watchlist entry = watchlistRepository.findByIdAndUserId(watchlistId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Watchlist item not found or does not belong to user"));

        watchlistRepository.delete(entry);
    }

    @Transactional
    public void removeFromWatchlistBySymbol(Long userId, String symbol) {
        if (userId == null || symbol == null) {
            throw new IllegalArgumentException("User ID and Symbol are required");
        }

        String clean = symbol.trim().toUpperCase(Locale.ROOT);
        Watchlist entry = watchlistRepository.findByUserIdAndSymbol(userId, clean)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Symbol " + clean + " not found in user's watchlist"));

        watchlistRepository.delete(entry);
    }

    @Transactional
    public void reorderWatchlist(Long userId, ReorderWatchlistRequest request) {
        if (userId == null) {
            throw new IllegalArgumentException("User ID is required");
        }
        if (request == null || request.orderedIds() == null || request.orderedIds().isEmpty()) {
            return;
        }

        List<Watchlist> userItems = watchlistRepository.findByUserId(userId);
        Map<Long, Watchlist> itemMap = userItems.stream().collect(Collectors.toMap(Watchlist::getId, w -> w));

        int order = 0;
        for (Long id : request.orderedIds()) {
            Watchlist w = itemMap.get(id);
            if (w != null) {
                w.setDisplayOrder(order++);
                watchlistRepository.save(w);
            }
        }
    }

    @Transactional(readOnly = true)
    public boolean isInWatchlist(Long userId, String symbol) {
        if (userId == null || symbol == null) {
            return false;
        }
        return watchlistRepository.existsByUserIdAndSymbol(userId, symbol.trim().toUpperCase(Locale.ROOT));
    }

    public String detectCategory(String symbol) {
        if (symbol == null) return "STOCKS";
        String s = symbol.trim().toUpperCase(Locale.ROOT);

        if (s.startsWith("NSE_INDEX") || s.contains("NIFTY") || s.equals("SENSEX") || s.equals("BANKNIFTY") ||
                s.equals("SPY") || s.equals("QQQ") || s.equals("DIA") || s.equals("IWM") || s.startsWith("^")) {
            return "INDICES";
        }
        if (s.contains("/") && (s.contains("BTC") || s.contains("ETH") || s.contains("SOL") || s.contains("DOGE") || s.contains("USDT") || s.contains("XRP"))) {
            return "CRYPTO";
        }
        if (s.contains("/") && (s.contains("USD") || s.contains("EUR") || s.contains("GBP") || s.contains("JPY") || s.contains("AUD") || s.contains("CAD") || s.contains("CHF"))) {
            return "FOREX";
        }
        if (s.startsWith("BTC") || s.startsWith("ETH") || s.startsWith("SOL") || s.startsWith("DOGE")) {
            return "CRYPTO";
        }
        return "STOCKS";
    }

    public String detectProvider(String symbol) {
        if (symbol == null) return "Twelve Data";
        String upper = symbol.trim().toUpperCase(Locale.ROOT);
        if (upstoxService != null && upstoxService.isIndianSymbol(upper)) {
            return "Upstox";
        }
        if (upper.startsWith("NSE_") || upper.startsWith("BSE_") || upper.contains("NIFTY") || upper.equals("SENSEX")) {
            return "Upstox";
        }
        return "Twelve Data";
    }

    public String detectExchange(String symbol) {
        if (symbol == null) return "NASDAQ";
        String upper = symbol.trim().toUpperCase(Locale.ROOT);
        if (upper.contains("BSE") || upper.equals("SENSEX")) return "BSE";
        if (upper.startsWith("NSE_") || upper.contains("NIFTY") || List.of("RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK", "SBIN", "BHARTIARTL", "ITC", "KOTAKBANK", "LT").contains(upper)) {
            return "NSE";
        }
        if (upper.contains("/")) {
            return (upper.contains("BTC") || upper.contains("ETH") || upper.contains("SOL")) ? "Crypto" : "Forex";
        }
        return "NASDAQ";
    }

    public String detectCurrency(String symbol) {
        if (symbol == null) return "USD";
        String upper = symbol.trim().toUpperCase(Locale.ROOT);
        if ("Upstox".equalsIgnoreCase(detectProvider(upper))) {
            return "INR";
        }
        return "USD";
    }

    private String normalizeCategory(String cat, String symbol) {
        if (cat != null && !cat.trim().isEmpty()) {
            String c = cat.trim().toUpperCase(Locale.ROOT);
            if (List.of("INDICES", "STOCKS", "FOREX", "CRYPTO").contains(c)) {
                return c;
            }
        }
        return detectCategory(symbol);
    }
}
