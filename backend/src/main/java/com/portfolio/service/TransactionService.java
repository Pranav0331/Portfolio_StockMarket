package com.portfolio.service;

import com.portfolio.dto.common.PageResponseDto;
import com.portfolio.dto.market.StockQuoteDto;
import com.portfolio.dto.transaction.TransactionDto;
import com.portfolio.entity.Stock;
import com.portfolio.entity.Transaction;
import com.portfolio.entity.enums.TradingMode;
import com.portfolio.entity.enums.TransactionType;
import com.portfolio.repository.TransactionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class TransactionService {

    private static final Logger log = LoggerFactory.getLogger(TransactionService.class);

    private final TransactionRepository transactionRepository;
    private final MarketDataService marketDataService;
    private final UpstoxService upstoxService;

    @org.springframework.beans.factory.annotation.Autowired
    public TransactionService(
            TransactionRepository transactionRepository,
            MarketDataService marketDataService,
            UpstoxService upstoxService
    ) {
        this.transactionRepository = transactionRepository;
        this.marketDataService = marketDataService;
        this.upstoxService = upstoxService;
    }

    // Convenience constructor for tests
    public TransactionService(TransactionRepository transactionRepository) {
        this(transactionRepository, null, null);
    }

    @Transactional(readOnly = true)
    public PageResponseDto<TransactionDto> getUserTransactions(
            Long userId,
            String type,
            String tradingMode,
            String symbol,
            Instant startDate,
            Instant endDate,
            int page,
            int size,
            String sortDirection
    ) {
        if (userId == null) {
            throw new IllegalArgumentException("User ID must not be null");
        }

        // Validate and clamp pagination
        int pageIndex = Math.max(0, page);
        int pageSize = (size <= 0 || size > 100) ? 15 : size;

        // Determine sorting direction (default DESC = newest first)
        Sort.Direction direction = "asc".equalsIgnoreCase(sortDirection)
                ? Sort.Direction.ASC
                : Sort.Direction.DESC;
        Pageable pageable = PageRequest.of(pageIndex, pageSize, Sort.by(direction, "createdAt"));

        // Parse TransactionType filter
        TransactionType transactionType = null;
        if (type != null && !type.trim().isEmpty() && !"ALL".equalsIgnoreCase(type.trim())) {
            try {
                transactionType = TransactionType.valueOf(type.trim().toUpperCase());
            } catch (IllegalArgumentException e) {
                log.warn("Unknown transaction type filter: {}", type);
            }
        }

        // Parse TradingMode filter
        TradingMode mode = null;
        if (tradingMode != null && !tradingMode.trim().isEmpty() && !"ALL".equalsIgnoreCase(tradingMode.trim())) {
            try {
                mode = TradingMode.valueOf(tradingMode.trim().toUpperCase());
            } catch (IllegalArgumentException e) {
                log.warn("Unknown trading mode filter: {}", tradingMode);
            }
        }

        // Parse symbol filter
        String cleanSymbol = (symbol != null && !symbol.trim().isEmpty())
                ? symbol.trim()
                : null;

        log.debug("Fetching transactions for user {}: type={}, mode={}, symbol={}, startDate={}, endDate={}, page={}, size={}",
                userId, transactionType, mode, cleanSymbol, startDate, endDate, pageIndex, pageSize);

        Page<Transaction> transactionPage = transactionRepository.findUserTransactions(
                userId,
                transactionType,
                mode,
                cleanSymbol,
                startDate,
                endDate,
                pageable
        );

        Map<String, BigDecimal> currentPricesCache = new HashMap<>();

        List<TransactionDto> dtoList = transactionPage.getContent().stream()
                .map(t -> mapToDto(t, currentPricesCache))
                .toList();

        return new PageResponseDto<>(
                dtoList,
                transactionPage.getNumber(),
                transactionPage.getSize(),
                transactionPage.getTotalElements(),
                transactionPage.getTotalPages(),
                transactionPage.isFirst(),
                transactionPage.isLast()
        );
    }

    @Transactional(readOnly = true)
    public PageResponseDto<TransactionDto> getUserTransactions(
            Long userId,
            String type,
            String symbol,
            Instant startDate,
            Instant endDate,
            int page,
            int size,
            String sortDirection
    ) {
        return getUserTransactions(userId, type, null, symbol, startDate, endDate, page, size, sortDirection);
    }

    private TransactionDto mapToDto(Transaction t, Map<String, BigDecimal> currentPricesCache) {
        Stock stock = t.getStock();
        String symbol = stock != null ? stock.getSymbol() : "UNKNOWN";
        String companyName = stock != null && stock.getCompanyName() != null ? stock.getCompanyName() : symbol;
        String exchange = stock != null && stock.getExchange() != null ? stock.getExchange() : "NSE";
        String currency = stock != null && stock.getCurrency() != null ? stock.getCurrency() : "USD";

        Long orderId = t.getOrder() != null ? t.getOrder().getId() : null;

        String status = "EXECUTED";
        if (t.getOrder() != null && t.getOrder().getOrderStatus() != null) {
            status = t.getOrder().getOrderStatus().name();
        } else if (t.getStatus() != null) {
            status = t.getStatus().name();
        }

        String tradingMode = "INTRADAY";
        if (t.getTradingMode() != null) {
            tradingMode = t.getTradingMode().name();
        } else if (t.getOrder() != null && t.getOrder().getTradingMode() != null) {
            tradingMode = t.getOrder().getTradingMode().name();
        }

        BigDecimal executionPrice = t.getPricePerUnit();
        if (executionPrice == null && t.getOrder() != null) {
            executionPrice = t.getOrder().getExecutedPrice();
        }
        if (executionPrice == null) {
            executionPrice = BigDecimal.ZERO;
        }

        BigDecimal quantity = t.getQuantity() != null ? t.getQuantity() : BigDecimal.ZERO;
        BigDecimal totalAmount = t.getTotalAmount() != null ? t.getTotalAmount() : executionPrice.multiply(quantity).setScale(4, RoundingMode.HALF_UP);
        BigDecimal fees = t.getFees() != null ? t.getFees() : BigDecimal.ZERO;

        Instant executedAt = t.getCreatedAt();
        if (executedAt == null && t.getOrder() != null) {
            executedAt = t.getOrder().getExecutedAt();
        }
        if (executedAt == null) {
            executedAt = Instant.now();
        }

        BigDecimal pnl = BigDecimal.ZERO;
        BigDecimal pnlPercent = BigDecimal.ZERO;
        BigDecimal avgBuyPrice = t.getAvgBuyPrice();
        BigDecimal currentPrice = executionPrice;

        if (t.getTransactionType() == TransactionType.SELL) {
            // Realized P&L
            if (t.getPnl() != null) {
                pnl = t.getPnl();
                pnlPercent = t.getPnlPercent() != null ? t.getPnlPercent() : BigDecimal.ZERO;
            } else if (avgBuyPrice != null && quantity.compareTo(BigDecimal.ZERO) > 0) {
                BigDecimal costBasis = avgBuyPrice.multiply(quantity).setScale(4, RoundingMode.HALF_UP);
                pnl = totalAmount.subtract(costBasis).subtract(fees).setScale(4, RoundingMode.HALF_UP);
                if (costBasis.compareTo(BigDecimal.ZERO) > 0) {
                    pnlPercent = pnl.divide(costBasis, 4, RoundingMode.HALF_UP)
                            .multiply(BigDecimal.valueOf(100))
                            .setScale(2, RoundingMode.HALF_UP);
                }
            }
            currentPrice = executionPrice;
        } else if (t.getTransactionType() == TransactionType.BUY) {
            // Unrealized P&L based on current real market price
            avgBuyPrice = executionPrice;
            BigDecimal livePrice = getRealCurrentPrice(symbol, stock, currentPricesCache);
            currentPrice = livePrice != null ? livePrice : executionPrice;

            if (quantity.compareTo(BigDecimal.ZERO) > 0 && executionPrice.compareTo(BigDecimal.ZERO) > 0) {
                BigDecimal currentValue = currentPrice.multiply(quantity).setScale(4, RoundingMode.HALF_UP);
                BigDecimal invested = executionPrice.multiply(quantity).setScale(4, RoundingMode.HALF_UP);
                pnl = currentValue.subtract(invested).setScale(4, RoundingMode.HALF_UP);
                pnlPercent = invested.compareTo(BigDecimal.ZERO) > 0
                        ? pnl.divide(invested, 4, RoundingMode.HALF_UP).multiply(BigDecimal.valueOf(100)).setScale(2, RoundingMode.HALF_UP)
                        : BigDecimal.ZERO;
            }
        }

        String positionSide = t.getPositionSide() != null ? t.getPositionSide().name() : (t.getOrder() != null && t.getOrder().getPositionSide() != null ? t.getOrder().getPositionSide().name() : null);
        Integer leverage = t.getLeverage() != null ? t.getLeverage() : (t.getOrder() != null && t.getOrder().getLeverage() != null ? t.getOrder().getLeverage() : 1);
        BigDecimal marginUsed = t.getMarginUsed() != null ? t.getMarginUsed() : (t.getOrder() != null && t.getOrder().getMarginUsed() != null ? t.getOrder().getMarginUsed() : BigDecimal.ZERO);
        Long positionId = t.getPositionId() != null ? t.getPositionId() : (t.getOrder() != null ? t.getOrder().getPositionId() : null);

        return new TransactionDto(
                t.getId(),
                orderId,
                positionId,
                symbol,
                companyName,
                exchange,
                currency,
                t.getTransactionType() != null ? t.getTransactionType().name() : "BUY",
                status,
                tradingMode,
                positionSide,
                leverage,
                marginUsed,
                quantity,
                executionPrice,
                totalAmount,
                fees,
                executedAt,
                pnl,
                pnlPercent,
                avgBuyPrice,
                currentPrice
        );
    }

    private BigDecimal getRealCurrentPrice(String symbol, Stock stock, Map<String, BigDecimal> cache) {
        if (symbol == null || symbol.isBlank() || "UNKNOWN".equalsIgnoreCase(symbol)) {
            return stock != null ? stock.getCurrentPrice() : null;
        }

        return cache.computeIfAbsent(symbol.trim().toUpperCase(), sym -> {
            try {
                StockQuoteDto quote = null;
                if (upstoxService != null && upstoxService.isIndianSymbol(sym)) {
                    quote = upstoxService.getQuote(sym);
                } else if (marketDataService != null) {
                    quote = marketDataService.getQuote(sym);
                }

                if (quote != null && quote.price() != null && quote.price().compareTo(BigDecimal.ZERO) > 0) {
                    return quote.price();
                }
            } catch (Exception e) {
                log.debug("Could not fetch real quote for symbol {}: {}", sym, e.getMessage());
            }

            if (stock != null && stock.getCurrentPrice() != null && stock.getCurrentPrice().compareTo(BigDecimal.ZERO) > 0) {
                return stock.getCurrentPrice();
            }

            return null;
        });
    }
}
