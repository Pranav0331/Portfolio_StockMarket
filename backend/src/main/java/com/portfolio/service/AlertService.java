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
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@Service
public class AlertService {

    private static final Logger log = LoggerFactory.getLogger(AlertService.class);

    private final AlertRepository alertRepository;
    private final StockRepository stockRepository;
    private final UserRepository userRepository;
    private final TradingService tradingService;
    private final UpstoxService upstoxService;

    public AlertService(
            AlertRepository alertRepository,
            StockRepository stockRepository,
            UserRepository userRepository,
            TradingService tradingService,
            @org.springframework.beans.factory.annotation.Autowired(required = false) UpstoxService upstoxService
    ) {
        this.alertRepository = alertRepository;
        this.stockRepository = stockRepository;
        this.userRepository = userRepository;
        this.tradingService = tradingService;
        this.upstoxService = upstoxService;
    }

    @Transactional
    public AlertsResponseDto getUserAlerts(Long userId) {
        if (userId == null) {
            throw new IllegalArgumentException("User ID is required");
        }

        List<Alert> alerts = alertRepository.findByUserIdOrderByCreatedAtDesc(userId);
        List<AlertItemDto> dtos = new ArrayList<>();

        int activeCount = 0;
        int triggeredCount = 0;
        int disabledCount = 0;

        for (Alert alert : alerts) {
            Stock stock = alert.getStock();
            String symbol = stock != null ? stock.getSymbol() : "UNKNOWN";
            String provider = detectProvider(symbol);

            BigDecimal currentPrice = null;
            boolean priceAvailable = false;
            String message = null;

            try {
                StockQuoteDto quote = tradingService.fetchRealMarketQuote(symbol);
                if (quote != null && quote.price() != null && quote.price().compareTo(BigDecimal.ZERO) > 0) {
                    currentPrice = quote.price();
                    priceAvailable = true;

                    // Evaluate if ACTIVE
                    if (alert.getStatus() == AlertStatus.ACTIVE) {
                        boolean triggered = checkConditionMet(alert.getConditionType(), currentPrice, alert.getTargetPrice());
                        if (triggered) {
                            alert.setStatus(AlertStatus.TRIGGERED);
                            alert.setTriggeredAt(Instant.now());
                            alert.setTriggeredPrice(currentPrice);
                            alertRepository.save(alert);
                            log.info("Alert ID {} for user {} symbol {} TRIGGERED at price {}", alert.getId(), userId, symbol, currentPrice);
                        }
                    }

                    if (stock != null) {
                        stock.setCurrentPrice(currentPrice);
                        if (quote.previousClose() != null) {
                            stock.setPreviousClose(quote.previousClose());
                        }
                        stockRepository.save(stock);
                    }
                } else {
                    message = "Market data unavailable";
                }
            } catch (Exception e) {
                log.warn("Could not fetch real quote for alert evaluation {}: {}", symbol, e.getMessage());
                message = "Market data unavailable";
            }

            if (alert.getStatus() == AlertStatus.ACTIVE) {
                activeCount++;
            } else if (alert.getStatus() == AlertStatus.TRIGGERED) {
                triggeredCount++;
            } else {
                disabledCount++;
            }

            dtos.add(mapToDto(alert, currentPrice, priceAvailable, provider, message));
        }

        return new AlertsResponseDto(
                dtos,
                dtos.size(),
                activeCount,
                triggeredCount,
                disabledCount,
                System.currentTimeMillis()
        );
    }

    @Transactional
    public AlertItemDto createAlert(Long userId, CreateAlertRequest request) {
        if (userId == null) {
            throw new IllegalArgumentException("User ID is required");
        }
        if (request == null || request.symbol() == null || request.symbol().trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Symbol is required");
        }
        if (request.targetPrice() == null || request.targetPrice().compareTo(BigDecimal.ZERO) <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Target price must be greater than 0");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));

        String cleanSymbol = request.symbol().trim().toUpperCase(Locale.ROOT);
        AlertCondition condition = AlertCondition.fromString(request.condition());

        // Duplicate active alert check
        boolean exists = alertRepository.existsByUserIdAndStockSymbolAndConditionTypeAndTargetPriceAndStatus(
                userId, cleanSymbol, condition, request.targetPrice(), AlertStatus.ACTIVE);
        if (exists) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "An active alert for " + cleanSymbol + " with target price " + request.targetPrice() + " and condition " + condition + " already exists");
        }

        // Fetch or create stock
        Stock stock = stockRepository.findBySymbol(cleanSymbol).orElse(null);
        String provider = detectProvider(cleanSymbol);
        BigDecimal currentPrice = null;
        boolean priceAvailable = false;
        String message = null;

        try {
            StockQuoteDto quote = tradingService.fetchRealMarketQuote(cleanSymbol);
            if (quote != null && quote.price() != null && quote.price().compareTo(BigDecimal.ZERO) > 0) {
                currentPrice = quote.price();
                priceAvailable = true;

                if (stock == null) {
                    String name = quote.name() != null ? quote.name() : cleanSymbol;
                    String exchange = detectExchange(cleanSymbol);
                    String currency = detectCurrency(cleanSymbol);
                    stock = new Stock(cleanSymbol, name, exchange, currency);
                    stock.setCurrentPrice(currentPrice);
                    if (quote.previousClose() != null) {
                        stock.setPreviousClose(quote.previousClose());
                    }
                    stock = stockRepository.save(stock);
                } else {
                    stock.setCurrentPrice(currentPrice);
                    if (quote.previousClose() != null) {
                        stock.setPreviousClose(quote.previousClose());
                    }
                    stockRepository.save(stock);
                }
            } else {
                message = "Market data unavailable";
            }
        } catch (Exception e) {
            log.warn("Could not fetch real quote for symbol {}: {}", cleanSymbol, e.getMessage());
            message = "Market data unavailable";
        }

        if (stock == null) {
            String exchange = detectExchange(cleanSymbol);
            String currency = detectCurrency(cleanSymbol);
            stock = new Stock(cleanSymbol, cleanSymbol, exchange, currency);
            stock = stockRepository.save(stock);
        }

        Alert alert = new Alert(user, stock, request.targetPrice(), condition, request.notes());
        alert.setStatus(AlertStatus.ACTIVE);

        // Immediate evaluation if price is available
        if (priceAvailable && currentPrice != null) {
            boolean triggered = checkConditionMet(condition, currentPrice, request.targetPrice());
            if (triggered) {
                alert.setStatus(AlertStatus.TRIGGERED);
                alert.setTriggeredAt(Instant.now());
                alert.setTriggeredPrice(currentPrice);
            }
        }

        alert = alertRepository.save(alert);

        return mapToDto(alert, currentPrice, priceAvailable, provider, message);
    }

    @Transactional
    public AlertItemDto updateAlert(Long userId, Long alertId, UpdateAlertRequest request) {
        if (userId == null || alertId == null) {
            throw new IllegalArgumentException("User ID and Alert ID are required");
        }

        Alert alert = alertRepository.findByIdAndUserId(alertId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Alert not found or does not belong to user"));

        if (request.targetPrice() != null) {
            if (request.targetPrice().compareTo(BigDecimal.ZERO) <= 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Target price must be greater than 0");
            }
            alert.setTargetPrice(request.targetPrice());
        }

        if (request.condition() != null && !request.condition().trim().isEmpty()) {
            alert.setConditionType(AlertCondition.fromString(request.condition()));
        }

        if (request.status() != null && !request.status().trim().isEmpty()) {
            AlertStatus newStatus = AlertStatus.fromString(request.status());
            if (newStatus == AlertStatus.ACTIVE && alert.getStatus() != AlertStatus.ACTIVE) {
                alert.setTriggeredAt(null);
                alert.setTriggeredPrice(null);
            }
            alert.setStatus(newStatus);
        }

        if (request.notes() != null) {
            alert.setNotes(request.notes().trim());
        }

        Stock stock = alert.getStock();
        String symbol = stock != null ? stock.getSymbol() : "UNKNOWN";
        String provider = detectProvider(symbol);
        BigDecimal currentPrice = null;
        boolean priceAvailable = false;
        String message = null;

        try {
            StockQuoteDto quote = tradingService.fetchRealMarketQuote(symbol);
            if (quote != null && quote.price() != null && quote.price().compareTo(BigDecimal.ZERO) > 0) {
                currentPrice = quote.price();
                priceAvailable = true;

                if (alert.getStatus() == AlertStatus.ACTIVE) {
                    boolean triggered = checkConditionMet(alert.getConditionType(), currentPrice, alert.getTargetPrice());
                    if (triggered) {
                        alert.setStatus(AlertStatus.TRIGGERED);
                        alert.setTriggeredAt(Instant.now());
                        alert.setTriggeredPrice(currentPrice);
                    }
                }
            } else {
                message = "Market data unavailable";
            }
        } catch (Exception e) {
            log.warn("Could not fetch real quote on update for {}: {}", symbol, e.getMessage());
            message = "Market data unavailable";
        }

        alert = alertRepository.save(alert);
        return mapToDto(alert, currentPrice, priceAvailable, provider, message);
    }

    @Transactional
    public AlertItemDto toggleAlertStatus(Long userId, Long alertId) {
        if (userId == null || alertId == null) {
            throw new IllegalArgumentException("User ID and Alert ID are required");
        }

        Alert alert = alertRepository.findByIdAndUserId(alertId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Alert not found or does not belong to user"));

        if (alert.getStatus() == AlertStatus.ACTIVE) {
            alert.setStatus(AlertStatus.DISABLED);
        } else {
            alert.setStatus(AlertStatus.ACTIVE);
            alert.setTriggeredAt(null);
            alert.setTriggeredPrice(null);
        }

        Stock stock = alert.getStock();
        String symbol = stock != null ? stock.getSymbol() : "UNKNOWN";
        String provider = detectProvider(symbol);
        BigDecimal currentPrice = null;
        boolean priceAvailable = false;
        String message = null;

        if (alert.getStatus() == AlertStatus.ACTIVE) {
            try {
                StockQuoteDto quote = tradingService.fetchRealMarketQuote(symbol);
                if (quote != null && quote.price() != null && quote.price().compareTo(BigDecimal.ZERO) > 0) {
                    currentPrice = quote.price();
                    priceAvailable = true;
                    boolean triggered = checkConditionMet(alert.getConditionType(), currentPrice, alert.getTargetPrice());
                    if (triggered) {
                        alert.setStatus(AlertStatus.TRIGGERED);
                        alert.setTriggeredAt(Instant.now());
                        alert.setTriggeredPrice(currentPrice);
                    }
                } else {
                    message = "Market data unavailable";
                }
            } catch (Exception e) {
                log.warn("Could not fetch real quote on toggle for {}: {}", symbol, e.getMessage());
                message = "Market data unavailable";
            }
        }

        alert = alertRepository.save(alert);
        return mapToDto(alert, currentPrice, priceAvailable, provider, message);
    }

    @Transactional
    public void deleteAlert(Long userId, Long alertId) {
        if (userId == null || alertId == null) {
            throw new IllegalArgumentException("User ID and Alert ID are required");
        }

        Alert alert = alertRepository.findByIdAndUserId(alertId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Alert not found or does not belong to user"));

        alertRepository.delete(alert);
    }

    private boolean checkConditionMet(AlertCondition condition, BigDecimal currentPrice, BigDecimal targetPrice) {
        if (condition == null || currentPrice == null || targetPrice == null) {
            return false;
        }

        if (condition == AlertCondition.ABOVE || condition == AlertCondition.GREATER_THAN_OR_EQUAL) {
            return currentPrice.compareTo(targetPrice) >= 0;
        } else if (condition == AlertCondition.BELOW || condition == AlertCondition.LESS_THAN_OR_EQUAL) {
            return currentPrice.compareTo(targetPrice) <= 0;
        }
        return false;
    }

    private AlertItemDto mapToDto(Alert alert, BigDecimal currentPrice, boolean priceAvailable, String provider, String message) {
        Stock stock = alert.getStock();
        String symbol = stock != null ? stock.getSymbol() : "UNKNOWN";
        String companyName = stock != null ? stock.getCompanyName() : symbol;
        String exchange = stock != null ? stock.getExchange() : "NSE";
        String currency = stock != null ? stock.getCurrency() : "USD";

        String conditionDisplay = (alert.getConditionType() == AlertCondition.BELOW || alert.getConditionType() == AlertCondition.LESS_THAN_OR_EQUAL)
                ? "BELOW" : "ABOVE";

        Long triggeredAtMs = alert.getTriggeredAt() != null ? alert.getTriggeredAt().toEpochMilli() : null;
        Long createdAtMs = alert.getCreatedAt() != null ? alert.getCreatedAt().toEpochMilli() : null;
        Long updatedAtMs = alert.getUpdatedAt() != null ? alert.getUpdatedAt().toEpochMilli() : null;

        return new AlertItemDto(
                alert.getId(),
                stock != null ? stock.getId() : null,
                symbol,
                companyName,
                exchange,
                currency,
                alert.getTargetPrice(),
                conditionDisplay,
                alert.getStatus().name(),
                currentPrice,
                priceAvailable,
                alert.getTriggeredPrice(),
                triggeredAtMs,
                createdAtMs,
                updatedAtMs,
                provider,
                alert.getNotes(),
                message
        );
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
}
