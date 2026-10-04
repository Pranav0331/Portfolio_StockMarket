package com.portfolio.service;

import com.portfolio.dto.market.StockQuoteDto;
import com.portfolio.dto.trading.TradeRequestDto;
import com.portfolio.dto.trading.TradeResponseDto;
import com.portfolio.dto.trading.UserHoldingDto;
import com.portfolio.dto.trading.VirtualWalletDto;
import com.portfolio.entity.Holding;
import com.portfolio.entity.Order;
import com.portfolio.entity.Stock;
import com.portfolio.entity.Transaction;
import com.portfolio.entity.User;
import com.portfolio.entity.enums.OrderStatus;
import com.portfolio.entity.enums.OrderType;
import com.portfolio.entity.enums.TransactionStatus;
import com.portfolio.entity.enums.TransactionType;
import com.portfolio.repository.HoldingRepository;
import com.portfolio.repository.OrderRepository;
import com.portfolio.repository.StockRepository;
import com.portfolio.repository.TransactionRepository;
import com.portfolio.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class TradingService {

    private static final Logger log = LoggerFactory.getLogger(TradingService.class);

    public static final BigDecimal DEFAULT_INITIAL_BALANCE = new BigDecimal("100000.0000");

    private final UserRepository userRepository;
    private final StockRepository stockRepository;
    private final HoldingRepository holdingRepository;
    private final OrderRepository orderRepository;
    private final TransactionRepository transactionRepository;
    private final MarketDataService marketDataService;
    private final UpstoxService upstoxService;

    // Per-user locks to prevent duplicate concurrent trade executions
    private final Map<Long, Object> userLocks = new ConcurrentHashMap<>();

    public TradingService(
            UserRepository userRepository,
            StockRepository stockRepository,
            HoldingRepository holdingRepository,
            OrderRepository orderRepository,
            TransactionRepository transactionRepository,
            MarketDataService marketDataService,
            UpstoxService upstoxService
    ) {
        this.userRepository = userRepository;
        this.stockRepository = stockRepository;
        this.holdingRepository = holdingRepository;
        this.orderRepository = orderRepository;
        this.transactionRepository = transactionRepository;
        this.marketDataService = marketDataService;
        this.upstoxService = upstoxService;
    }

    private Object getUserLock(Long userId) {
        return userLocks.computeIfAbsent(userId, k -> new Object());
    }

    // =========================================================================
    // 1. BUY EXECUTION
    // =========================================================================

    @Transactional
    public TradeResponseDto executeBuy(Long userId, TradeRequestDto request) {
        if (request.quantity() == null || request.quantity().compareTo(BigDecimal.ZERO) <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Quantity must be greater than zero");
        }

        String symbol = request.symbol().trim().toUpperCase();
        if (symbol.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Symbol cannot be empty");
        }

        synchronized (getUserLock(userId)) {
            User user = userRepository.findById(userId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found with id: " + userId));

            // Fetch REAL execution price from existing market data backend
            StockQuoteDto quote = fetchRealMarketQuote(symbol);
            if (quote == null || quote.price() == null || quote.price().compareTo(BigDecimal.ZERO) <= 0) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Real market price unavailable for symbol: " + symbol);
            }

            BigDecimal executionPrice = quote.price();
            BigDecimal quantity = request.quantity().setScale(4, RoundingMode.HALF_UP);
            BigDecimal totalAmount = executionPrice.multiply(quantity).setScale(4, RoundingMode.HALF_UP);

            // Validate virtual cash balance
            BigDecimal currentCashBalance = calculateCashBalance(userId);
            if (currentCashBalance.compareTo(totalAmount) < 0) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        String.format("Insufficient virtual balance. Required: %s, Available: %s", totalAmount, currentCashBalance)
                );
            }

            // Upsert Stock entity
            Stock stock = findOrCreateStock(quote, symbol);

            // Create and execute Order
            Order order = new Order();
            order.setUser(user);
            order.setStock(stock);
            order.setOrderType(OrderType.BUY);
            order.setOrderStatus(OrderStatus.EXECUTED);
            order.setQuantity(quantity);
            order.setPrice(executionPrice);
            order.setExecutedPrice(executionPrice);
            order.setExecutedAt(Instant.now());
            order = orderRepository.save(order);

            // Update or create Holding
            Optional<Holding> holdingOpt = holdingRepository.findByUserIdAndStock_Symbol(userId, symbol);
            Holding holding;
            BigDecimal newHoldingQuantity;

            if (holdingOpt.isPresent()) {
                holding = holdingOpt.get();
                newHoldingQuantity = holding.getQuantity().add(quantity).setScale(4, RoundingMode.HALF_UP);
                BigDecimal newTotalInvested = holding.getTotalInvested().add(totalAmount).setScale(4, RoundingMode.HALF_UP);
                BigDecimal newAvgPrice = newTotalInvested.divide(newHoldingQuantity, 4, RoundingMode.HALF_UP);

                holding.setQuantity(newHoldingQuantity);
                holding.setTotalInvested(newTotalInvested);
                holding.setAverageBuyPrice(newAvgPrice);
            } else {
                newHoldingQuantity = quantity;
                holding = new Holding(user, stock, quantity, executionPrice, totalAmount);
            }
            holdingRepository.save(holding);

            // Create Transaction record
            Transaction transaction = new Transaction();
            transaction.setUser(user);
            transaction.setStock(stock);
            transaction.setOrder(order);
            transaction.setTransactionType(TransactionType.BUY);
            transaction.setStatus(TransactionStatus.SUCCESS);
            transaction.setQuantity(quantity);
            transaction.setPricePerUnit(executionPrice);
            transaction.setTotalAmount(totalAmount);
            transaction.setFees(BigDecimal.ZERO);
            transaction.setAvgBuyPrice(executionPrice);
            transaction.setPnl(BigDecimal.ZERO);
            transaction.setPnlPercent(BigDecimal.ZERO);
            transaction = transactionRepository.save(transaction);

            BigDecimal remainingBalance = currentCashBalance.subtract(totalAmount).setScale(4, RoundingMode.HALF_UP);

            log.info("Simulated BUY executed for user {} on {}: qty={}, price={}, total={}",
                    userId, symbol, quantity, executionPrice, totalAmount);

            return new TradeResponseDto(
                    order.getId(),
                    transaction.getId(),
                    symbol,
                    stock.getCompanyName(),
                    OrderType.BUY,
                    OrderStatus.EXECUTED,
                    quantity,
                    executionPrice,
                    totalAmount,
                    remainingBalance,
                    newHoldingQuantity,
                    order.getExecutedAt(),
                    String.format("Successfully bought %s shares of %s at %s", quantity, symbol, executionPrice)
            );
        }
    }

    // =========================================================================
    // 2. SELL EXECUTION
    // =========================================================================

    @Transactional
    public TradeResponseDto executeSell(Long userId, TradeRequestDto request) {
        if (request.quantity() == null || request.quantity().compareTo(BigDecimal.ZERO) <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Quantity must be greater than zero");
        }

        String symbol = request.symbol().trim().toUpperCase();
        if (symbol.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Symbol cannot be empty");
        }

        synchronized (getUserLock(userId)) {
            User user = userRepository.findById(userId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found with id: " + userId));

            // Verify sufficient holdings
            Holding holding = holdingRepository.findByUserIdAndStock_Symbol(userId, symbol)
                    .orElseThrow(() -> new ResponseStatusException(
                            HttpStatus.BAD_REQUEST,
                            "You do not own any shares of " + symbol
                    ));

            BigDecimal sellQuantity = request.quantity().setScale(4, RoundingMode.HALF_UP);
            if (holding.getQuantity().compareTo(sellQuantity) < 0) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        String.format("Insufficient holdings to sell. Owned: %s, Requested: %s", holding.getQuantity(), sellQuantity)
                );
            }

            // Fetch REAL execution price
            StockQuoteDto quote = fetchRealMarketQuote(symbol);
            if (quote == null || quote.price() == null || quote.price().compareTo(BigDecimal.ZERO) <= 0) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Real market price unavailable for symbol: " + symbol);
            }

            BigDecimal executionPrice = quote.price();
            BigDecimal totalAmount = executionPrice.multiply(sellQuantity).setScale(4, RoundingMode.HALF_UP);

            // Calculate Realized P&L using average buy price before updating holding
            BigDecimal avgBuyPrice = holding.getAverageBuyPrice() != null ? holding.getAverageBuyPrice() : executionPrice;
            BigDecimal costBasis = avgBuyPrice.multiply(sellQuantity).setScale(4, RoundingMode.HALF_UP);
            BigDecimal realizedPnL = totalAmount.subtract(costBasis).setScale(4, RoundingMode.HALF_UP);
            BigDecimal realizedPnLPercent = BigDecimal.ZERO;
            if (costBasis.compareTo(BigDecimal.ZERO) > 0) {
                realizedPnLPercent = realizedPnL.divide(costBasis, 4, RoundingMode.HALF_UP)
                        .multiply(new BigDecimal("100"))
                        .setScale(2, RoundingMode.HALF_UP);
            }

            Stock stock = findOrCreateStock(quote, symbol);

            // Create and execute Order
            Order order = new Order();
            order.setUser(user);
            order.setStock(stock);
            order.setOrderType(OrderType.SELL);
            order.setOrderStatus(OrderStatus.EXECUTED);
            order.setQuantity(sellQuantity);
            order.setPrice(executionPrice);
            order.setExecutedPrice(executionPrice);
            order.setExecutedAt(Instant.now());
            order = orderRepository.save(order);

            // Update Holding
            BigDecimal remainingHoldingQuantity;
            if (holding.getQuantity().compareTo(sellQuantity) == 0) {
                remainingHoldingQuantity = BigDecimal.ZERO;
                holdingRepository.delete(holding);
            } else {
                remainingHoldingQuantity = holding.getQuantity().subtract(sellQuantity).setScale(4, RoundingMode.HALF_UP);
                BigDecimal newTotalInvested = holding.getAverageBuyPrice().multiply(remainingHoldingQuantity).setScale(4, RoundingMode.HALF_UP);
                holding.setQuantity(remainingHoldingQuantity);
                holding.setTotalInvested(newTotalInvested);
                holdingRepository.save(holding);
            }

            // Create Transaction record with Realized P&L
            Transaction transaction = new Transaction();
            transaction.setUser(user);
            transaction.setStock(stock);
            transaction.setOrder(order);
            transaction.setTransactionType(TransactionType.SELL);
            transaction.setStatus(TransactionStatus.SUCCESS);
            transaction.setQuantity(sellQuantity);
            transaction.setPricePerUnit(executionPrice);
            transaction.setTotalAmount(totalAmount);
            transaction.setFees(BigDecimal.ZERO);
            transaction.setAvgBuyPrice(avgBuyPrice);
            transaction.setPnl(realizedPnL);
            transaction.setPnlPercent(realizedPnLPercent);
            transaction = transactionRepository.save(transaction);

            BigDecimal currentCashBalance = calculateCashBalance(userId);

            log.info("Simulated SELL executed for user {} on {}: qty={}, price={}, total={}, realizedPnL={}",
                    userId, symbol, sellQuantity, executionPrice, totalAmount, realizedPnL);

            return new TradeResponseDto(
                    order.getId(),
                    transaction.getId(),
                    symbol,
                    stock.getCompanyName(),
                    OrderType.SELL,
                    OrderStatus.EXECUTED,
                    sellQuantity,
                    executionPrice,
                    totalAmount,
                    currentCashBalance,
                    remainingHoldingQuantity,
                    order.getExecutedAt(),
                    String.format("Successfully sold %s shares of %s at %s", sellQuantity, symbol, executionPrice)
            );
        }
    }

    // =========================================================================
    // 3. VIRTUAL WALLET & BALANCE
    // =========================================================================

    @Transactional(readOnly = true)
    public VirtualWalletDto getWallet(Long userId) {
        BigDecimal cashBalance = calculateCashBalance(userId);
        List<Holding> holdings = holdingRepository.findByUserId(userId);

        BigDecimal totalInvested = BigDecimal.ZERO;
        BigDecimal totalHoldingMarketValue = BigDecimal.ZERO;

        for (Holding h : holdings) {
            totalInvested = totalInvested.add(h.getTotalInvested() != null ? h.getTotalInvested() : BigDecimal.ZERO);

            // Get current price if available, otherwise use average buy price
            BigDecimal currentPrice = h.getStock() != null && h.getStock().getCurrentPrice() != null
                    ? h.getStock().getCurrentPrice()
                    : h.getAverageBuyPrice();

            if (currentPrice != null && h.getQuantity() != null) {
                totalHoldingMarketValue = totalHoldingMarketValue.add(currentPrice.multiply(h.getQuantity()));
            }
        }

        BigDecimal totalPortfolioValue = cashBalance.add(totalHoldingMarketValue).setScale(4, RoundingMode.HALF_UP);

        return new VirtualWalletDto(
                cashBalance.setScale(2, RoundingMode.HALF_UP),
                totalInvested.setScale(2, RoundingMode.HALF_UP),
                totalPortfolioValue.setScale(2, RoundingMode.HALF_UP),
                "USD"
        );
    }

    public BigDecimal calculateCashBalance(Long userId) {
        BigDecimal balance = DEFAULT_INITIAL_BALANCE;
        List<Transaction> transactions = transactionRepository.findByUserId(userId);

        for (Transaction t : transactions) {
            if (t.getStatus() != TransactionStatus.SUCCESS) continue;

            BigDecimal amount = t.getTotalAmount() != null ? t.getTotalAmount() : BigDecimal.ZERO;
            BigDecimal fees = t.getFees() != null ? t.getFees() : BigDecimal.ZERO;

            if (t.getTransactionType() == TransactionType.BUY) {
                balance = balance.subtract(amount).subtract(fees);
            } else if (t.getTransactionType() == TransactionType.SELL) {
                balance = balance.add(amount).subtract(fees);
            } else if (t.getTransactionType() == TransactionType.DEPOSIT || t.getTransactionType() == TransactionType.DIVIDEND) {
                balance = balance.add(amount).subtract(fees);
            } else if (t.getTransactionType() == TransactionType.WITHDRAWAL) {
                balance = balance.subtract(amount).subtract(fees);
            }
        }

        return balance.setScale(4, RoundingMode.HALF_UP);
    }

    @Transactional
    public VirtualWalletDto depositCash(Long userId, BigDecimal amount) {
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Deposit amount must be greater than zero");
        }

        synchronized (getUserLock(userId)) {
            User user = userRepository.findById(userId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found with id: " + userId));

            BigDecimal depositAmount = amount.setScale(4, RoundingMode.HALF_UP);

            Transaction transaction = new Transaction();
            transaction.setUser(user);
            transaction.setTransactionType(TransactionType.DEPOSIT);
            transaction.setStatus(TransactionStatus.SUCCESS);
            transaction.setTotalAmount(depositAmount);
            transaction.setFees(BigDecimal.ZERO);
            transaction.setPnl(BigDecimal.ZERO);
            transaction.setPnlPercent(BigDecimal.ZERO);
            transactionRepository.save(transaction);

            log.info("Virtual cash deposit of {} for user {}", depositAmount, userId);

            return getWallet(userId);
        }
    }

    @Transactional
    public VirtualWalletDto resetCashBalance(Long userId, BigDecimal requestedTargetBalance) {
        synchronized (getUserLock(userId)) {
            User user = userRepository.findById(userId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found with id: " + userId));

            BigDecimal targetBalance = (requestedTargetBalance != null && requestedTargetBalance.compareTo(BigDecimal.ZERO) > 0)
                    ? requestedTargetBalance.setScale(4, RoundingMode.HALF_UP)
                    : DEFAULT_INITIAL_BALANCE;

            BigDecimal currentCash = calculateCashBalance(userId);
            BigDecimal diff = targetBalance.subtract(currentCash).setScale(4, RoundingMode.HALF_UP);

            if (diff.compareTo(BigDecimal.ZERO) > 0) {
                Transaction tx = new Transaction();
                tx.setUser(user);
                tx.setTransactionType(TransactionType.DEPOSIT);
                tx.setStatus(TransactionStatus.SUCCESS);
                tx.setTotalAmount(diff);
                tx.setFees(BigDecimal.ZERO);
                tx.setPnl(BigDecimal.ZERO);
                tx.setPnlPercent(BigDecimal.ZERO);
                transactionRepository.save(tx);
            } else if (diff.compareTo(BigDecimal.ZERO) < 0) {
                Transaction tx = new Transaction();
                tx.setUser(user);
                tx.setTransactionType(TransactionType.WITHDRAWAL);
                tx.setStatus(TransactionStatus.SUCCESS);
                tx.setTotalAmount(diff.abs());
                tx.setFees(BigDecimal.ZERO);
                tx.setPnl(BigDecimal.ZERO);
                tx.setPnlPercent(BigDecimal.ZERO);
                transactionRepository.save(tx);
            }

            log.info("Virtual cash balance reset to {} for user {}", targetBalance, userId);

            return getWallet(userId);
        }
    }

    // =========================================================================
    // 4. USER HOLDINGS
    // =========================================================================

    @Transactional
    public List<UserHoldingDto> getUserHoldings(Long userId) {
        List<Holding> holdings = holdingRepository.findByUserId(userId);
        List<UserHoldingDto> dtos = new ArrayList<>();

        for (Holding h : holdings) {
            Stock stock = h.getStock();
            String symbol = stock != null ? stock.getSymbol() : "UNKNOWN";
            String companyName = stock != null ? stock.getCompanyName() : symbol;
            String exchange = stock != null ? stock.getExchange() : "NSE";
            String currency = stock != null ? stock.getCurrency() : "USD";

            BigDecimal currentPrice = null;
            boolean priceAvailable = false;

            try {
                StockQuoteDto quote = fetchRealMarketQuote(symbol);
                if (quote != null && quote.price() != null && quote.price().compareTo(BigDecimal.ZERO) > 0) {
                    currentPrice = quote.price();
                    priceAvailable = true;
                    if (stock != null) {
                        stock.setCurrentPrice(currentPrice);
                        if (quote.previousClose() != null) {
                            stock.setPreviousClose(quote.previousClose());
                        }
                        stockRepository.save(stock);
                    }
                }
            } catch (Exception e) {
                log.debug("Could not refresh live quote for holding {}: {}", symbol, e.getMessage());
            }

            if (currentPrice == null) {
                currentPrice = stock != null && stock.getCurrentPrice() != null
                        ? stock.getCurrentPrice()
                        : h.getAverageBuyPrice();
            }

            BigDecimal currentValue = currentPrice.multiply(h.getQuantity()).setScale(4, RoundingMode.HALF_UP);
            BigDecimal unrealizedPnL = currentValue.subtract(h.getTotalInvested()).setScale(4, RoundingMode.HALF_UP);

            BigDecimal unrealizedPnLPercent = BigDecimal.ZERO;
            if (h.getTotalInvested().compareTo(BigDecimal.ZERO) > 0) {
                unrealizedPnLPercent = unrealizedPnL.divide(h.getTotalInvested(), 4, RoundingMode.HALF_UP)
                        .multiply(new BigDecimal("100"))
                        .setScale(2, RoundingMode.HALF_UP);
            }

            dtos.add(new UserHoldingDto(
                    h.getId(),
                    symbol,
                    companyName,
                    exchange,
                    currency,
                    h.getQuantity().setScale(4, RoundingMode.HALF_UP),
                    h.getAverageBuyPrice().setScale(4, RoundingMode.HALF_UP),
                    h.getTotalInvested().setScale(4, RoundingMode.HALF_UP),
                    currentPrice.setScale(4, RoundingMode.HALF_UP),
                    currentValue.setScale(4, RoundingMode.HALF_UP),
                    unrealizedPnL,
                    unrealizedPnLPercent,
                    BigDecimal.ZERO,
                    priceAvailable || (stock != null && stock.getCurrentPrice() != null)
            ));
        }

        return dtos;
    }

    @Transactional
    public Optional<UserHoldingDto> getUserHoldingForSymbol(Long userId, String symbol) {
        return holdingRepository.findByUserIdAndStock_Symbol(userId, symbol.trim().toUpperCase())
                .map(h -> {
                    Stock stock = h.getStock();
                    String sym = stock != null ? stock.getSymbol() : symbol;
                    String companyName = stock != null ? stock.getCompanyName() : sym;
                    String exchange = stock != null ? stock.getExchange() : "NSE";
                    String currency = stock != null ? stock.getCurrency() : "USD";

                    BigDecimal currentPrice = null;
                    boolean priceAvailable = false;

                    try {
                        StockQuoteDto quote = fetchRealMarketQuote(sym);
                        if (quote != null && quote.price() != null && quote.price().compareTo(BigDecimal.ZERO) > 0) {
                            currentPrice = quote.price();
                            priceAvailable = true;
                            if (stock != null) {
                                stock.setCurrentPrice(currentPrice);
                                if (quote.previousClose() != null) {
                                    stock.setPreviousClose(quote.previousClose());
                                }
                                stockRepository.save(stock);
                            }
                        }
                    } catch (Exception e) {
                        log.debug("Could not refresh live quote for holding {}: {}", sym, e.getMessage());
                    }

                    if (currentPrice == null) {
                        currentPrice = stock != null && stock.getCurrentPrice() != null
                                ? stock.getCurrentPrice()
                                : h.getAverageBuyPrice();
                    }

                    BigDecimal currentValue = currentPrice.multiply(h.getQuantity()).setScale(4, RoundingMode.HALF_UP);
                    BigDecimal unrealizedPnL = currentValue.subtract(h.getTotalInvested()).setScale(4, RoundingMode.HALF_UP);

                    BigDecimal unrealizedPnLPercent = BigDecimal.ZERO;
                    if (h.getTotalInvested().compareTo(BigDecimal.ZERO) > 0) {
                        unrealizedPnLPercent = unrealizedPnL.divide(h.getTotalInvested(), 4, RoundingMode.HALF_UP)
                                .multiply(new BigDecimal("100"))
                                .setScale(2, RoundingMode.HALF_UP);
                    }

                    return new UserHoldingDto(
                            h.getId(),
                            sym,
                            companyName,
                            exchange,
                            currency,
                            h.getQuantity().setScale(4, RoundingMode.HALF_UP),
                            h.getAverageBuyPrice().setScale(4, RoundingMode.HALF_UP),
                            h.getTotalInvested().setScale(4, RoundingMode.HALF_UP),
                            currentPrice.setScale(4, RoundingMode.HALF_UP),
                            currentValue.setScale(4, RoundingMode.HALF_UP),
                            unrealizedPnL,
                            unrealizedPnLPercent,
                            BigDecimal.ZERO,
                            priceAvailable || (stock != null && stock.getCurrentPrice() != null)
                    );
                });
    }

    // =========================================================================
    // 5. HELPER METHODS
    // =========================================================================

    public StockQuoteDto fetchRealMarketQuote(String symbol) {
        if (upstoxService != null && upstoxService.isIndianSymbol(symbol)) {
            return upstoxService.getQuote(symbol);
        } else {
            return marketDataService.getQuote(symbol);
        }
    }

    private Stock findOrCreateStock(StockQuoteDto quote, String symbol) {
        Optional<Stock> stockOpt = stockRepository.findBySymbol(symbol);
        Stock stock;

        if (stockOpt.isPresent()) {
            stock = stockOpt.get();
            if (quote.price() != null) {
                stock.setCurrentPrice(quote.price());
            }
            if (quote.previousClose() != null) {
                stock.setPreviousClose(quote.previousClose());
            }
            if (quote.name() != null && !quote.name().isBlank()) {
                stock.setCompanyName(quote.name());
            }
        } else {
            String companyName = quote.name() != null && !quote.name().isBlank() ? quote.name() : symbol;
            boolean isIndian = upstoxService != null && upstoxService.isIndianSymbol(symbol);
            String exchange = isIndian ? (symbol.contains("SENSEX") ? "BSE" : "NSE") : (symbol.contains("/") ? "Crypto/Forex" : "NASDAQ");
            String currency = isIndian ? "INR" : "USD";

            stock = new Stock(symbol, companyName, exchange, currency);
            stock.setCurrentPrice(quote.price());
            stock.setPreviousClose(quote.previousClose());
        }

        return stockRepository.save(stock);
    }
}
