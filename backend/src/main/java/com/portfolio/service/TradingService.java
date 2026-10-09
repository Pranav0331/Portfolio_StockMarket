package com.portfolio.service;

import com.portfolio.dto.market.StockQuoteDto;
import com.portfolio.dto.trading.*;
import com.portfolio.entity.*;
import com.portfolio.entity.enums.*;
import com.portfolio.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.*;
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
    private final PositionRepository positionRepository;
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
            PositionRepository positionRepository,
            MarketDataService marketDataService,
            UpstoxService upstoxService
    ) {
        this.userRepository = userRepository;
        this.stockRepository = stockRepository;
        this.holdingRepository = holdingRepository;
        this.orderRepository = orderRepository;
        this.transactionRepository = transactionRepository;
        this.positionRepository = positionRepository;
        this.marketDataService = marketDataService;
        this.upstoxService = upstoxService;
    }

    private Object getUserLock(Long userId) {
        return userLocks.computeIfAbsent(userId, k -> new Object());
    }

    // =========================================================================
    // 1. BUY / LONG EXECUTION (EXNESS-STYLE PAPER TRADING)
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
            BigDecimal positionValue = executionPrice.multiply(quantity).setScale(4, RoundingMode.HALF_UP);

            TradingMode tradingMode = request.tradingMode() != null ? request.tradingMode() : TradingMode.INTRADAY;
            PositionSide side = request.side() != null ? request.side() : PositionSide.LONG;

            // Leverage: Scalping/Intraday support 1:1, 1:2, 1:5, 1:10, 1:20, 1:50, 1:100 (Default 1:10)
            // Swing / Long Term are spot (leverage = 1)
            int leverage = 1;
            if (tradingMode == TradingMode.SCALPING || tradingMode == TradingMode.INTRADAY) {
                if (request.leverage() != null && request.leverage() > 0) {
                    leverage = request.leverage();
                } else {
                    leverage = 10;
                }
            }

            BigDecimal marginUsed = positionValue.divide(BigDecimal.valueOf(leverage), 4, RoundingMode.HALF_UP);

            // Validate available paper balance against required margin
            BigDecimal currentCashBalance = calculateCashBalance(userId);
            if (currentCashBalance.compareTo(marginUsed) < 0) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        String.format("Insufficient virtual balance for required margin. Required: $%s, Available: $%s", marginUsed, currentCashBalance)
                );
            }

            // Validate Stop Loss and Take Profit if provided
            validateSlTp(side, executionPrice, request.stopLoss(), request.takeProfit());

            // Upsert Stock entity
            Stock stock = findOrCreateStock(quote, symbol);

            // 1. Create Position
            Position position = new Position(
                    user,
                    stock,
                    side,
                    tradingMode,
                    quantity,
                    executionPrice,
                    leverage,
                    marginUsed,
                    request.stopLoss(),
                    request.takeProfit()
            );
            position = positionRepository.save(position);

            // 2. Create Order
            Order order = new Order();
            order.setUser(user);
            order.setStock(stock);
            order.setOrderType(OrderType.BUY);
            order.setOrderStatus(OrderStatus.EXECUTED);
            order.setTradingMode(tradingMode);
            order.setPositionSide(side);
            order.setLeverage(leverage);
            order.setMarginUsed(marginUsed);
            order.setStopLoss(request.stopLoss());
            order.setTakeProfit(request.takeProfit());
            order.setPositionId(position.getId());
            order.setQuantity(quantity);
            order.setPrice(executionPrice);
            order.setExecutedPrice(executionPrice);
            order.setExecutedAt(Instant.now());
            order = orderRepository.save(order);

            // 3. Create Transaction
            Transaction transaction = new Transaction();
            transaction.setUser(user);
            transaction.setStock(stock);
            transaction.setOrder(order);
            transaction.setTransactionType(TransactionType.BUY);
            transaction.setStatus(TransactionStatus.SUCCESS);
            transaction.setTradingMode(tradingMode);
            transaction.setPositionSide(side);
            transaction.setLeverage(leverage);
            transaction.setMarginUsed(marginUsed);
            transaction.setPositionId(position.getId());
            transaction.setQuantity(quantity);
            transaction.setPricePerUnit(executionPrice);
            transaction.setTotalAmount(marginUsed);
            transaction.setFees(BigDecimal.ZERO);
            transaction.setAvgBuyPrice(executionPrice);
            transaction.setPnl(BigDecimal.ZERO);
            transaction.setPnlPercent(BigDecimal.ZERO);
            transaction = transactionRepository.save(transaction);

            // 4. Update spot Holding for spot trades / portfolio tracking
            BigDecimal newHoldingQuantity = BigDecimal.ZERO;
            Optional<Holding> holdingOpt = holdingRepository.findByUserIdAndStock_Symbol(userId, symbol);
            if (holdingOpt.isPresent()) {
                Holding holding = holdingOpt.get();
                newHoldingQuantity = holding.getQuantity().add(quantity).setScale(4, RoundingMode.HALF_UP);
                BigDecimal newTotalInvested = holding.getTotalInvested().add(positionValue).setScale(4, RoundingMode.HALF_UP);
                BigDecimal newAvgPrice = newTotalInvested.divide(newHoldingQuantity, 4, RoundingMode.HALF_UP);

                holding.setQuantity(newHoldingQuantity);
                holding.setTotalInvested(newTotalInvested);
                holding.setAverageBuyPrice(newAvgPrice);
                holdingRepository.save(holding);
            } else {
                newHoldingQuantity = quantity;
                Holding holding = new Holding(user, stock, quantity, executionPrice, positionValue);
                holdingRepository.save(holding);
            }

            BigDecimal remainingBalance = currentCashBalance.subtract(marginUsed).setScale(4, RoundingMode.HALF_UP);

            log.info("Paper BUY executed for user {} on {} with mode {}, leverage 1:{}, side {}: qty={}, price={}, margin={}",
                    userId, symbol, tradingMode, leverage, side, quantity, executionPrice, marginUsed);

            return new TradeResponseDto(
                    order.getId(),
                    transaction.getId(),
                    position.getId(),
                    symbol,
                    stock.getCompanyName(),
                    OrderType.BUY,
                    side,
                    OrderStatus.EXECUTED,
                    tradingMode,
                    quantity,
                    executionPrice,
                    positionValue,
                    leverage,
                    marginUsed,
                    request.stopLoss(),
                    request.takeProfit(),
                    remainingBalance,
                    newHoldingQuantity,
                    order.getExecutedAt(),
                    String.format("Successfully opened %s %s position on %s at %s (1:%dx Leverage, Margin: $%s)",
                            tradingMode, side, symbol, executionPrice, leverage, marginUsed)
            );
        }
    }

    // =========================================================================
    // 2. SELL / SHORT EXECUTION (EXNESS-STYLE PAPER TRADING)
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

            BigDecimal sellQuantity = request.quantity().setScale(4, RoundingMode.HALF_UP);
            TradingMode tradingMode = request.tradingMode() != null ? request.tradingMode() : TradingMode.INTRADAY;

            // Determine whether this is a SHORT paper position or closing a spot holding
            boolean isShortPosition = request.side() == PositionSide.SHORT;
            Holding holding = null;

            if (!isShortPosition) {
                holding = holdingRepository.findByUserIdAndStock_Symbol(userId, symbol)
                        .orElseThrow(() -> new ResponseStatusException(
                                HttpStatus.BAD_REQUEST,
                                "You do not own any shares of " + symbol
                        ));

                if (holding.getQuantity().compareTo(sellQuantity) < 0) {
                    throw new ResponseStatusException(
                            HttpStatus.BAD_REQUEST,
                            String.format("Insufficient holdings to sell. Owned: %s, Requested: %s", holding.getQuantity(), sellQuantity)
                    );
                }
            }

            StockQuoteDto quote = fetchRealMarketQuote(symbol);
            if (quote == null || quote.price() == null || quote.price().compareTo(BigDecimal.ZERO) <= 0) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Real market price unavailable for symbol: " + symbol);
            }

            BigDecimal executionPrice = quote.price();
            BigDecimal positionValue = executionPrice.multiply(sellQuantity).setScale(4, RoundingMode.HALF_UP);
            Stock stock = findOrCreateStock(quote, symbol);

            if (isShortPosition) {
                // =============================================================
                // OPEN SHORT MARGIN POSITION
                // =============================================================
                int leverage = 1;
                if (tradingMode == TradingMode.SCALPING || tradingMode == TradingMode.INTRADAY) {
                    leverage = request.leverage() != null && request.leverage() > 0 ? request.leverage() : 10;
                }

                BigDecimal marginUsed = positionValue.divide(BigDecimal.valueOf(leverage), 4, RoundingMode.HALF_UP);
                BigDecimal currentCashBalance = calculateCashBalance(userId);

                if (currentCashBalance.compareTo(marginUsed) < 0) {
                    throw new ResponseStatusException(
                            HttpStatus.BAD_REQUEST,
                            String.format("Insufficient virtual balance for required margin. Required: $%s, Available: $%s", marginUsed, currentCashBalance)
                    );
                }

                validateSlTp(PositionSide.SHORT, executionPrice, request.stopLoss(), request.takeProfit());

                // Create Position (SHORT)
                Position position = new Position(
                        user,
                        stock,
                        PositionSide.SHORT,
                        tradingMode,
                        sellQuantity,
                        executionPrice,
                        leverage,
                        marginUsed,
                        request.stopLoss(),
                        request.takeProfit()
                );
                position = positionRepository.save(position);

                // Create Order (SELL / SHORT)
                Order order = new Order();
                order.setUser(user);
                order.setStock(stock);
                order.setOrderType(OrderType.SELL);
                order.setOrderStatus(OrderStatus.EXECUTED);
                order.setTradingMode(tradingMode);
                order.setPositionSide(PositionSide.SHORT);
                order.setLeverage(leverage);
                order.setMarginUsed(marginUsed);
                order.setStopLoss(request.stopLoss());
                order.setTakeProfit(request.takeProfit());
                order.setPositionId(position.getId());
                order.setQuantity(sellQuantity);
                order.setPrice(executionPrice);
                order.setExecutedPrice(executionPrice);
                order.setExecutedAt(Instant.now());
                order = orderRepository.save(order);

                // Create Transaction
                Transaction transaction = new Transaction();
                transaction.setUser(user);
                transaction.setStock(stock);
                transaction.setOrder(order);
                transaction.setTransactionType(TransactionType.SELL);
                transaction.setStatus(TransactionStatus.SUCCESS);
                transaction.setTradingMode(tradingMode);
                transaction.setPositionSide(PositionSide.SHORT);
                transaction.setLeverage(leverage);
                transaction.setMarginUsed(marginUsed);
                transaction.setPositionId(position.getId());
                transaction.setQuantity(sellQuantity);
                transaction.setPricePerUnit(executionPrice);
                transaction.setTotalAmount(marginUsed);
                transaction.setFees(BigDecimal.ZERO);
                transaction.setAvgBuyPrice(executionPrice);
                transaction.setPnl(BigDecimal.ZERO);
                transaction.setPnlPercent(BigDecimal.ZERO);
                transaction = transactionRepository.save(transaction);

                BigDecimal remainingBalance = currentCashBalance.subtract(marginUsed).setScale(4, RoundingMode.HALF_UP);

                log.info("Paper SHORT position opened for user {} on {} with mode {}, leverage 1:{}: qty={}, price={}, margin={}",
                        userId, symbol, tradingMode, leverage, sellQuantity, executionPrice, marginUsed);

                return new TradeResponseDto(
                        order.getId(),
                        transaction.getId(),
                        position.getId(),
                        symbol,
                        stock.getCompanyName(),
                        OrderType.SELL,
                        PositionSide.SHORT,
                        OrderStatus.EXECUTED,
                        tradingMode,
                        sellQuantity,
                        executionPrice,
                        positionValue,
                        leverage,
                        marginUsed,
                        request.stopLoss(),
                        request.takeProfit(),
                        remainingBalance,
                        BigDecimal.ZERO,
                        order.getExecutedAt(),
                        String.format("Successfully opened %s SHORT position on %s at %s (1:%dx Leverage, Margin: $%s)",
                                tradingMode, symbol, executionPrice, leverage, marginUsed)
                );
            } else {
                // =============================================================
                // CLOSE / REDUCE EXISTING SPOT HOLDING
                // =============================================================
                BigDecimal totalAmount = executionPrice.multiply(sellQuantity).setScale(4, RoundingMode.HALF_UP);
                BigDecimal avgBuyPrice = holding.getAverageBuyPrice() != null ? holding.getAverageBuyPrice() : executionPrice;
                BigDecimal costBasis = avgBuyPrice.multiply(sellQuantity).setScale(4, RoundingMode.HALF_UP);
                BigDecimal realizedPnL = totalAmount.subtract(costBasis).setScale(4, RoundingMode.HALF_UP);
                BigDecimal realizedPnLPercent = BigDecimal.ZERO;
                if (costBasis.compareTo(BigDecimal.ZERO) > 0) {
                    realizedPnLPercent = realizedPnL.divide(costBasis, 4, RoundingMode.HALF_UP)
                            .multiply(new BigDecimal("100"))
                            .setScale(2, RoundingMode.HALF_UP);
                }

                // Create Order
                Order order = new Order();
                order.setUser(user);
                order.setStock(stock);
                order.setOrderType(OrderType.SELL);
                order.setOrderStatus(OrderStatus.EXECUTED);
                order.setTradingMode(tradingMode);
                order.setPositionSide(PositionSide.LONG);
                order.setLeverage(1);
                order.setMarginUsed(BigDecimal.ZERO);
                order.setRealizedPnl(realizedPnL);
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
                transaction.setTradingMode(tradingMode);
                transaction.setPositionSide(PositionSide.LONG);
                transaction.setLeverage(1);
                transaction.setMarginUsed(BigDecimal.ZERO);
                transaction.setQuantity(sellQuantity);
                transaction.setPricePerUnit(executionPrice);
                transaction.setTotalAmount(totalAmount);
                transaction.setFees(BigDecimal.ZERO);
                transaction.setAvgBuyPrice(avgBuyPrice);
                transaction.setPnl(realizedPnL);
                transaction.setPnlPercent(realizedPnLPercent);
                transaction = transactionRepository.save(transaction);

                BigDecimal currentCashBalance = calculateCashBalance(userId);

                log.info("Simulated SPOT SELL executed for user {} on {} with mode {}: qty={}, price={}, total={}, realizedPnL={}",
                        userId, symbol, tradingMode, sellQuantity, executionPrice, totalAmount, realizedPnL);

                return new TradeResponseDto(
                        order.getId(),
                        transaction.getId(),
                        null,
                        symbol,
                        stock.getCompanyName(),
                        OrderType.SELL,
                        PositionSide.LONG,
                        OrderStatus.EXECUTED,
                        tradingMode,
                        sellQuantity,
                        executionPrice,
                        totalAmount,
                        1,
                        BigDecimal.ZERO,
                        null,
                        null,
                        currentCashBalance,
                        remainingHoldingQuantity,
                        order.getExecutedAt(),
                        String.format("Successfully sold %s shares of %s at %s (%s)", sellQuantity, symbol, executionPrice, tradingMode)
                );
            }
        }
    }

    // =========================================================================
    // 3. CLOSE POSITION (MANUAL & SL/TP TRIGGER)
    // =========================================================================

    @Transactional
    public PositionDto closePosition(Long userId, Long positionId, BigDecimal requestedCloseQty) {
        synchronized (getUserLock(userId)) {
            Optional<Position> positionOpt = positionRepository.findByIdAndUserId(positionId, userId);
            if (positionOpt.isPresent()) {
                Position position = positionOpt.get();
                if (position.getStatus() != PositionStatus.OPEN) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Position is already closed");
                }

                if (requestedCloseQty != null && requestedCloseQty.compareTo(BigDecimal.ZERO) <= 0) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Close quantity must be greater than zero");
                }

                if (requestedCloseQty != null && requestedCloseQty.compareTo(position.getQuantity()) > 0) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                            String.format("Insufficient position quantity. Open quantity is %s, requested close: %s",
                                    position.getQuantity(), requestedCloseQty));
                }

                String symbol = position.getStock() != null ? position.getStock().getSymbol() : "UNKNOWN";
                StockQuoteDto quote = fetchRealMarketQuote(symbol);
                if (quote == null || quote.price() == null || quote.price().compareTo(BigDecimal.ZERO) <= 0) {
                    throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Real market price unavailable to close position: " + symbol);
                }

                BigDecimal closePrice = quote.price();
                return executeClosePositionInternal(position, closePrice, requestedCloseQty, "Manual Close");
            }

            // Fallback: Check if it matches an open holding
            Optional<Holding> holdingOpt = holdingRepository.findByIdAndUserId(positionId, userId);
            if (holdingOpt.isEmpty()) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Position or holding not found with id: " + positionId);
            }

            Holding holding = holdingOpt.get();
            if (holding.getQuantity() == null || holding.getQuantity().compareTo(BigDecimal.ZERO) <= 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Holding has zero or negative quantity");
            }

            if (requestedCloseQty != null && requestedCloseQty.compareTo(BigDecimal.ZERO) <= 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Close quantity must be greater than zero");
            }

            if (requestedCloseQty != null && requestedCloseQty.compareTo(holding.getQuantity()) > 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        String.format("Insufficient holding quantity. Available is %s, requested close: %s",
                                holding.getQuantity(), requestedCloseQty));
            }

            User user = holding.getUser();
            Stock stock = holding.getStock();
            String symbol = stock != null ? stock.getSymbol() : "UNKNOWN";

            StockQuoteDto quote = fetchRealMarketQuote(symbol);
            if (quote == null || quote.price() == null || quote.price().compareTo(BigDecimal.ZERO) <= 0) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Real market price unavailable to close holding: " + symbol);
            }

            BigDecimal closePrice = quote.price();
            BigDecimal totalHoldingQty = holding.getQuantity();
            BigDecimal closeQty = (requestedCloseQty != null && requestedCloseQty.compareTo(BigDecimal.ZERO) > 0 && requestedCloseQty.compareTo(totalHoldingQty) < 0)
                    ? requestedCloseQty.setScale(4, RoundingMode.HALF_UP)
                    : totalHoldingQty;

            BigDecimal totalAmount = closePrice.multiply(closeQty).setScale(4, RoundingMode.HALF_UP);
            BigDecimal avgBuyPrice = holding.getAverageBuyPrice() != null ? holding.getAverageBuyPrice() : closePrice;
            BigDecimal costBasis = avgBuyPrice.multiply(closeQty).setScale(4, RoundingMode.HALF_UP);
            BigDecimal realizedPnL = totalAmount.subtract(costBasis).setScale(4, RoundingMode.HALF_UP);
            BigDecimal realizedPnLPercent = BigDecimal.ZERO;
            if (costBasis.compareTo(BigDecimal.ZERO) > 0) {
                realizedPnLPercent = realizedPnL.divide(costBasis, 4, RoundingMode.HALF_UP)
                        .multiply(new BigDecimal("100"))
                        .setScale(2, RoundingMode.HALF_UP);
            }

            // Update Holding
            boolean isPartial = closeQty.compareTo(totalHoldingQty) < 0;
            if (isPartial) {
                BigDecimal remainingHoldingQty = totalHoldingQty.subtract(closeQty).setScale(4, RoundingMode.HALF_UP);
                holding.setQuantity(remainingHoldingQty);
                BigDecimal newTotalInvested = avgBuyPrice.multiply(remainingHoldingQty).setScale(4, RoundingMode.HALF_UP);
                holding.setTotalInvested(newTotalInvested);
                holdingRepository.save(holding);
            } else {
                holdingRepository.delete(holding);
            }

            // Create Order
            Order order = new Order();
            order.setUser(user);
            order.setStock(stock);
            order.setOrderType(OrderType.SELL);
            order.setOrderStatus(OrderStatus.EXECUTED);
            order.setTradingMode(TradingMode.INTRADAY);
            order.setPositionSide(PositionSide.LONG);
            order.setLeverage(1);
            order.setMarginUsed(BigDecimal.ZERO);
            order.setRealizedPnl(realizedPnL);
            order.setQuantity(closeQty);
            order.setPrice(closePrice);
            order.setExecutedPrice(closePrice);
            order.setExecutedAt(Instant.now());
            orderRepository.save(order);

            // Create Transaction
            Transaction transaction = new Transaction();
            transaction.setUser(user);
            transaction.setStock(stock);
            transaction.setOrder(order);
            transaction.setTransactionType(TransactionType.SELL);
            transaction.setStatus(TransactionStatus.SUCCESS);
            transaction.setTradingMode(TradingMode.INTRADAY);
            transaction.setPositionSide(PositionSide.LONG);
            transaction.setLeverage(1);
            transaction.setMarginUsed(BigDecimal.ZERO);
            transaction.setQuantity(closeQty);
            transaction.setPricePerUnit(closePrice);
            transaction.setTotalAmount(totalAmount);
            transaction.setFees(BigDecimal.ZERO);
            transaction.setAvgBuyPrice(avgBuyPrice);
            transaction.setPnl(realizedPnL);
            transaction.setPnlPercent(realizedPnLPercent);
            transactionRepository.save(transaction);

            log.info("Closed {} spot holding #{} on {}: closedQty={}, remainingQty={}, entry={}, close={}, realizedPnL={}",
                    isPartial ? "PARTIAL" : "FULL", holding.getId(), symbol, closeQty, isPartial ? holding.getQuantity() : BigDecimal.ZERO, avgBuyPrice, closePrice, realizedPnL);

            String companyName = stock != null && stock.getCompanyName() != null ? stock.getCompanyName() : symbol;
            String exchange = stock != null && stock.getExchange() != null ? stock.getExchange() : "NSE";
            String currency = stock != null && stock.getCurrency() != null ? stock.getCurrency() : "USD";

            return new PositionDto(
                    holding.getId(),
                    symbol,
                    companyName,
                    exchange,
                    currency,
                    PositionSide.LONG,
                    TradingMode.INTRADAY,
                    closeQty,
                    avgBuyPrice,
                    closePrice,
                    1,
                    BigDecimal.ZERO,
                    totalAmount,
                    null,
                    null,
                    null,
                    null,
                    PositionStatus.CLOSED,
                    closePrice,
                    Instant.now(),
                    realizedPnL,
                    holding.getCreatedAt()
            );
        }
    }

    private PositionDto executeClosePositionInternal(Position position, BigDecimal closePrice, BigDecimal requestedCloseQty, String reason) {
        User user = position.getUser();
        Stock stock = position.getStock();
        String symbol = stock != null ? stock.getSymbol() : "UNKNOWN";
        BigDecimal totalPositionQty = position.getQuantity();
        BigDecimal entryPrice = position.getEntryPrice();
        BigDecimal totalMarginUsed = position.getMarginUsed() != null ? position.getMarginUsed() : BigDecimal.ZERO;

        BigDecimal closeQty = (requestedCloseQty != null && requestedCloseQty.compareTo(BigDecimal.ZERO) > 0 && requestedCloseQty.compareTo(totalPositionQty) < 0)
                ? requestedCloseQty.setScale(4, RoundingMode.HALF_UP)
                : totalPositionQty;

        boolean isPartial = closeQty.compareTo(totalPositionQty) < 0;

        // Margin to release proportionally
        BigDecimal marginToRelease;
        if (isPartial) {
            marginToRelease = totalMarginUsed.multiply(closeQty).divide(totalPositionQty, 4, RoundingMode.HALF_UP);
        } else {
            marginToRelease = totalMarginUsed;
        }

        // Calculate Realized P&L for the closed quantity
        BigDecimal realizedPnl;
        if (position.getSide() == PositionSide.LONG) {
            realizedPnl = closePrice.subtract(entryPrice).multiply(closeQty).setScale(4, RoundingMode.HALF_UP);
        } else {
            realizedPnl = entryPrice.subtract(closePrice).multiply(closeQty).setScale(4, RoundingMode.HALF_UP);
        }

        BigDecimal realizedPnlPercent = BigDecimal.ZERO;
        if (marginToRelease.compareTo(BigDecimal.ZERO) > 0) {
            realizedPnlPercent = realizedPnl.divide(marginToRelease, 4, RoundingMode.HALF_UP)
                    .multiply(new BigDecimal("100"))
                    .setScale(2, RoundingMode.HALF_UP);
        }

        // Settlement amount returned to cash balance = marginToRelease + realizedPnl
        BigDecimal settlementAmount = marginToRelease.add(realizedPnl).setScale(4, RoundingMode.HALF_UP);
        if (settlementAmount.compareTo(BigDecimal.ZERO) < 0) {
            settlementAmount = BigDecimal.ZERO;
        }

        // Update Position entity
        if (isPartial) {
            BigDecimal remainingQty = totalPositionQty.subtract(closeQty).setScale(4, RoundingMode.HALF_UP);
            BigDecimal remainingMargin = totalMarginUsed.subtract(marginToRelease).setScale(4, RoundingMode.HALF_UP);
            position.setQuantity(remainingQty);
            position.setMarginUsed(remainingMargin);
            position.setStatus(PositionStatus.OPEN);
        } else {
            position.setStatus(PositionStatus.CLOSED);
            position.setClosePrice(closePrice);
            position.setCloseTime(Instant.now());
            position.setRealizedPnl(realizedPnl);
        }
        position = positionRepository.save(position);

        // Update spot Holding if LONG
        if (position.getSide() == PositionSide.LONG && user != null) {
            Optional<Holding> holdingOpt = holdingRepository.findByUserIdAndStock_Symbol(user.getId(), symbol);
            if (holdingOpt.isPresent()) {
                Holding h = holdingOpt.get();
                BigDecimal newHoldingQty = h.getQuantity().subtract(closeQty).setScale(4, RoundingMode.HALF_UP);
                if (newHoldingQty.compareTo(BigDecimal.ZERO) <= 0) {
                    holdingRepository.delete(h);
                } else {
                    h.setQuantity(newHoldingQty);
                    BigDecimal newInvested = h.getAverageBuyPrice().multiply(newHoldingQty).setScale(4, RoundingMode.HALF_UP);
                    h.setTotalInvested(newInvested);
                    holdingRepository.save(h);
                }
            }
        }

        // Closing Order type: if LONG -> SELL to close; if SHORT -> BUY to close
        OrderType closingOrderType = position.getSide() == PositionSide.LONG ? OrderType.SELL : OrderType.BUY;
        TransactionType closingTxType = position.getSide() == PositionSide.LONG ? TransactionType.SELL : TransactionType.BUY;

        Order order = new Order();
        order.setUser(user);
        order.setStock(stock);
        order.setOrderType(closingOrderType);
        order.setOrderStatus(OrderStatus.EXECUTED);
        order.setTradingMode(position.getTradingMode());
        order.setPositionSide(position.getSide());
        order.setLeverage(position.getLeverage());
        order.setMarginUsed(marginToRelease);
        order.setPositionId(position.getId());
        order.setRealizedPnl(realizedPnl);
        order.setQuantity(closeQty);
        order.setPrice(closePrice);
        order.setExecutedPrice(closePrice);
        order.setExecutedAt(Instant.now());
        orderRepository.save(order);

        // Transaction for position closing (settlement amount returned to cash balance)
        Transaction transaction = new Transaction();
        transaction.setUser(user);
        transaction.setStock(stock);
        transaction.setOrder(order);
        transaction.setTransactionType(closingTxType);
        transaction.setStatus(TransactionStatus.SUCCESS);
        transaction.setTradingMode(position.getTradingMode());
        transaction.setPositionSide(position.getSide());
        transaction.setLeverage(position.getLeverage());
        transaction.setMarginUsed(marginToRelease);
        transaction.setPositionId(position.getId());
        transaction.setQuantity(closeQty);
        transaction.setPricePerUnit(closePrice);
        transaction.setTotalAmount(settlementAmount);
        transaction.setFees(BigDecimal.ZERO);
        transaction.setAvgBuyPrice(entryPrice);
        transaction.setPnl(realizedPnl);
        transaction.setPnlPercent(realizedPnlPercent);
        transactionRepository.save(transaction);

        log.info("Closed {} paper position #{} on {} ({}): closedQty={}, remainingQty={}, entry={}, close={}, realizedPnL={} (ROI: {}%), Reason: {}",
                isPartial ? "PARTIAL" : "FULL", position.getId(), symbol, position.getSide(), closeQty, position.getQuantity(), entryPrice, closePrice, realizedPnl, realizedPnlPercent, reason);

        return mapPositionToDto(position, closePrice);
    }

    // =========================================================================
    // 4. UPDATE SL / TP FOR AN OPEN POSITION
    // =========================================================================

    @Transactional
    public PositionDto updatePositionSlTp(Long userId, Long positionId, UpdateSlTpRequestDto request) {
        synchronized (getUserLock(userId)) {
            Position position = positionRepository.findByIdAndUserId(positionId, userId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Position not found with id: " + positionId));

            if (position.getStatus() != PositionStatus.OPEN) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot edit SL/TP on a closed position");
            }

            validateSlTp(position.getSide(), position.getEntryPrice(), request.stopLoss(), request.takeProfit());

            position.setStopLoss(request.stopLoss());
            position.setTakeProfit(request.takeProfit());
            position = positionRepository.save(position);

            StockQuoteDto quote = fetchRealMarketQuote(position.getStock().getSymbol());
            BigDecimal currentPrice = quote != null && quote.price() != null ? quote.price() : position.getEntryPrice();

            return mapPositionToDto(position, currentPrice);
        }
    }

    // =========================================================================
    // 5. GET USER POSITIONS WITH LIVE FLOATING P&L & SL/TP EVALUATION
    // =========================================================================

    @Transactional
    public List<PositionDto> getUserPositions(Long userId, String symbol, PositionStatus status) {
        List<Position> positions = positionRepository.findFiltered(userId, symbol, status);
        List<PositionDto> dtos = new ArrayList<>();
        Map<String, BigDecimal> livePrices = new HashMap<>();

        for (Position p : positions) {
            String sym = p.getStock() != null ? p.getStock().getSymbol() : "UNKNOWN";
            BigDecimal currentPrice = p.getClosePrice();

            if (p.getStatus() == PositionStatus.OPEN) {
                BigDecimal liveP = livePrices.computeIfAbsent(sym, s -> {
                    try {
                        StockQuoteDto quote = fetchRealMarketQuote(s);
                        return quote != null && quote.price() != null ? quote.price() : null;
                    } catch (Exception e) {
                        return null;
                    }
                });

                if (liveP == null) {
                    liveP = p.getEntryPrice();
                }

                // Check automated SL / TP triggers
                if (shouldTriggerSlOrTp(p, liveP)) {
                    dtos.add(executeClosePositionInternal(p, liveP, null, "Automated SL/TP Trigger"));
                    continue;
                }

                currentPrice = liveP;
            }

            dtos.add(mapPositionToDto(p, currentPrice));
        }

        // Also include spot holdings that are not tracked as open position entities
        if (status == null || status == PositionStatus.OPEN) {
            List<Holding> holdings = holdingRepository.findByUserId(userId);
            for (Holding holding : holdings) {
                if (holding.getQuantity() == null || holding.getQuantity().compareTo(BigDecimal.ZERO) <= 0) {
                    continue;
                }
                if (holding.getStock() == null) {
                    continue;
                }
                String stockSymbol = holding.getStock().getSymbol();
                if (symbol != null && !symbol.isBlank() && !stockSymbol.equalsIgnoreCase(symbol.trim())) {
                    continue;
                }

                BigDecimal openPosQty = positions.stream()
                        .filter(p -> p.getStatus() == PositionStatus.OPEN && p.getSide() == PositionSide.LONG && p.getStock() != null && p.getStock().getId().equals(holding.getStock().getId()))
                        .map(Position::getQuantity)
                        .filter(Objects::nonNull)
                        .reduce(BigDecimal.ZERO, BigDecimal::add);

                BigDecimal unrepresentedQty = holding.getQuantity().subtract(openPosQty);
                if (unrepresentedQty.compareTo(BigDecimal.ZERO) > 0) {
                    BigDecimal liveP = livePrices.computeIfAbsent(stockSymbol, s -> {
                        try {
                            StockQuoteDto quote = fetchRealMarketQuote(s);
                            return quote != null && quote.price() != null ? quote.price() : null;
                        } catch (Exception e) {
                            return null;
                        }
                    });

                    if (liveP == null) {
                        liveP = holding.getAverageBuyPrice() != null ? holding.getAverageBuyPrice() : BigDecimal.ZERO;
                    }

                    BigDecimal avgBuyPrice = holding.getAverageBuyPrice() != null ? holding.getAverageBuyPrice() : liveP;
                    BigDecimal positionValue = liveP.multiply(unrepresentedQty).setScale(4, RoundingMode.HALF_UP);
                    BigDecimal margin = avgBuyPrice.multiply(unrepresentedQty).setScale(4, RoundingMode.HALF_UP);
                    BigDecimal unrealizedPnl = liveP.subtract(avgBuyPrice).multiply(unrepresentedQty).setScale(4, RoundingMode.HALF_UP);
                    BigDecimal unrealizedPnlPercent = BigDecimal.ZERO;
                    if (margin.compareTo(BigDecimal.ZERO) > 0) {
                        unrealizedPnlPercent = unrealizedPnl.divide(margin, 4, RoundingMode.HALF_UP)
                                .multiply(new BigDecimal("100"))
                                .setScale(2, RoundingMode.HALF_UP);
                    }

                    dtos.add(new PositionDto(
                            holding.getId(),
                            stockSymbol,
                            holding.getStock().getCompanyName() != null ? holding.getStock().getCompanyName() : stockSymbol,
                            holding.getStock().getExchange() != null ? holding.getStock().getExchange() : "CRYPTO",
                            holding.getStock().getCurrency() != null ? holding.getStock().getCurrency() : "USD",
                            PositionSide.LONG,
                            TradingMode.LONG_TERM,
                            unrepresentedQty,
                            avgBuyPrice,
                            liveP,
                            1,
                            margin,
                            positionValue,
                            unrealizedPnl,
                            unrealizedPnlPercent,
                            null,
                            null,
                            PositionStatus.OPEN,
                            null,
                            null,
                            null,
                            holding.getCreatedAt() != null ? holding.getCreatedAt() : Instant.now()
                    ));
                }
            }
        }

        return dtos;
    }

    private boolean shouldTriggerSlOrTp(Position p, BigDecimal currentPrice) {
        if (p.getStatus() != PositionStatus.OPEN || currentPrice == null) return false;

        if (p.getSide() == PositionSide.LONG) {
            if (p.getStopLoss() != null && currentPrice.compareTo(p.getStopLoss()) <= 0) return true;
            if (p.getTakeProfit() != null && currentPrice.compareTo(p.getTakeProfit()) >= 0) return true;
        } else if (p.getSide() == PositionSide.SHORT) {
            if (p.getStopLoss() != null && currentPrice.compareTo(p.getStopLoss()) >= 0) return true;
            if (p.getTakeProfit() != null && currentPrice.compareTo(p.getTakeProfit()) <= 0) return true;
        }

        return false;
    }

    private void validateSlTp(PositionSide side, BigDecimal entryPrice, BigDecimal stopLoss, BigDecimal takeProfit) {
        if (side == PositionSide.LONG) {
            if (stopLoss != null && stopLoss.compareTo(BigDecimal.ZERO) > 0 && stopLoss.compareTo(entryPrice) >= 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "For BUY/LONG, Stop Loss must be less than entry price (" + entryPrice + ")");
            }
            if (takeProfit != null && takeProfit.compareTo(BigDecimal.ZERO) > 0 && takeProfit.compareTo(entryPrice) <= 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "For BUY/LONG, Take Profit must be greater than entry price (" + entryPrice + ")");
            }
        } else if (side == PositionSide.SHORT) {
            if (stopLoss != null && stopLoss.compareTo(BigDecimal.ZERO) > 0 && stopLoss.compareTo(entryPrice) <= 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "For SELL/SHORT, Stop Loss must be greater than entry price (" + entryPrice + ")");
            }
            if (takeProfit != null && takeProfit.compareTo(BigDecimal.ZERO) > 0 && takeProfit.compareTo(entryPrice) >= 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "For SELL/SHORT, Take Profit must be less than entry price (" + entryPrice + ")");
            }
        }
    }

    public PositionDto mapPositionToDto(Position p, BigDecimal currentPrice) {
        Stock stock = p.getStock();
        String symbol = stock != null ? stock.getSymbol() : "UNKNOWN";
        String companyName = stock != null && stock.getCompanyName() != null ? stock.getCompanyName() : symbol;
        String exchange = stock != null && stock.getExchange() != null ? stock.getExchange() : "NSE";
        String currency = stock != null && stock.getCurrency() != null ? stock.getCurrency() : "USD";

        BigDecimal price = currentPrice != null ? currentPrice : p.getEntryPrice();
        BigDecimal qty = p.getQuantity() != null ? p.getQuantity() : BigDecimal.ZERO;
        BigDecimal margin = p.getMarginUsed() != null ? p.getMarginUsed() : BigDecimal.ZERO;
        BigDecimal positionValue = price.multiply(qty).setScale(4, RoundingMode.HALF_UP);

        BigDecimal unrealizedPnl = BigDecimal.ZERO;
        BigDecimal unrealizedPnlPercent = BigDecimal.ZERO;

        if (p.getStatus() == PositionStatus.OPEN) {
            if (p.getSide() == PositionSide.LONG) {
                unrealizedPnl = price.subtract(p.getEntryPrice()).multiply(qty).setScale(4, RoundingMode.HALF_UP);
            } else {
                unrealizedPnl = p.getEntryPrice().subtract(price).multiply(qty).setScale(4, RoundingMode.HALF_UP);
            }

            if (margin.compareTo(BigDecimal.ZERO) > 0) {
                unrealizedPnlPercent = unrealizedPnl.divide(margin, 4, RoundingMode.HALF_UP)
                        .multiply(new BigDecimal("100"))
                        .setScale(2, RoundingMode.HALF_UP);
            }
        }

        return new PositionDto(
                p.getId(),
                symbol,
                companyName,
                exchange,
                currency,
                p.getSide(),
                p.getTradingMode(),
                qty,
                p.getEntryPrice(),
                price,
                p.getLeverage(),
                margin,
                positionValue,
                p.getStatus() == PositionStatus.OPEN ? unrealizedPnl : null,
                p.getStatus() == PositionStatus.OPEN ? unrealizedPnlPercent : null,
                p.getStopLoss(),
                p.getTakeProfit(),
                p.getStatus(),
                p.getClosePrice(),
                p.getCloseTime(),
                p.getRealizedPnl(),
                p.getCreatedAt()
        );
    }

    // =========================================================================
    // 6. VIRTUAL WALLET & EXNESS-STYLE BALANCE CALCULATION
    // =========================================================================

    @Transactional(readOnly = true)
    public VirtualWalletDto getWallet(Long userId) {
        BigDecimal cashBalance = calculateCashBalance(userId);
        List<Holding> holdings = holdingRepository.findByUserId(userId);
        List<Position> openPositions = positionRepository.findByUserIdAndStatus(userId, PositionStatus.OPEN);

        BigDecimal totalInvested = BigDecimal.ZERO;
        BigDecimal totalHoldingMarketValue = BigDecimal.ZERO;

        for (Holding h : holdings) {
            totalInvested = totalInvested.add(h.getTotalInvested() != null ? h.getTotalInvested() : BigDecimal.ZERO);
            BigDecimal currentPrice = h.getStock() != null && h.getStock().getCurrentPrice() != null
                    ? h.getStock().getCurrentPrice()
                    : h.getAverageBuyPrice();
            if (currentPrice != null && h.getQuantity() != null) {
                totalHoldingMarketValue = totalHoldingMarketValue.add(currentPrice.multiply(h.getQuantity()));
            }
        }

        BigDecimal marginUsed = BigDecimal.ZERO;
        BigDecimal floatingPnl = BigDecimal.ZERO;

        for (Position pos : openPositions) {
            marginUsed = marginUsed.add(pos.getMarginUsed() != null ? pos.getMarginUsed() : BigDecimal.ZERO);
            BigDecimal curP = pos.getStock() != null && pos.getStock().getCurrentPrice() != null ? pos.getStock().getCurrentPrice() : pos.getEntryPrice();
            BigDecimal posPnl;
            if (pos.getSide() == PositionSide.LONG) {
                posPnl = curP.subtract(pos.getEntryPrice()).multiply(pos.getQuantity());
            } else {
                posPnl = pos.getEntryPrice().subtract(curP).multiply(pos.getQuantity());
            }
            floatingPnl = floatingPnl.add(posPnl);
        }

        BigDecimal equity = cashBalance.add(marginUsed).add(floatingPnl).add(totalHoldingMarketValue).setScale(4, RoundingMode.HALF_UP);
        BigDecimal marginLevelPercent = marginUsed.compareTo(BigDecimal.ZERO) > 0
                ? equity.divide(marginUsed, 4, RoundingMode.HALF_UP).multiply(BigDecimal.valueOf(100)).setScale(2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        return new VirtualWalletDto(
                cashBalance.setScale(2, RoundingMode.HALF_UP),
                totalInvested.add(marginUsed).setScale(2, RoundingMode.HALF_UP),
                equity.setScale(2, RoundingMode.HALF_UP),
                "USD",
                marginUsed.setScale(2, RoundingMode.HALF_UP),
                floatingPnl.setScale(2, RoundingMode.HALF_UP),
                cashBalance.setScale(2, RoundingMode.HALF_UP),
                marginLevelPercent
        );
    }

    public BigDecimal calculateCashBalance(Long userId) {
        BigDecimal balance = DEFAULT_INITIAL_BALANCE;
        List<Transaction> transactions = transactionRepository.findByUserId(userId);

        for (Transaction t : transactions) {
            if (t.getStatus() != TransactionStatus.SUCCESS) continue;

            BigDecimal amount = t.getTotalAmount() != null ? t.getTotalAmount() : BigDecimal.ZERO;
            BigDecimal fees = t.getFees() != null ? t.getFees() : BigDecimal.ZERO;

            if (t.getPositionId() != null) {
                // Margined position transaction
                boolean isCloseTransaction = (t.getPositionSide() == PositionSide.LONG && t.getTransactionType() == TransactionType.SELL)
                        || (t.getPositionSide() == PositionSide.SHORT && t.getTransactionType() == TransactionType.BUY);

                if (isCloseTransaction) {
                    // Position closed settlement returned to cash
                    balance = balance.add(amount).subtract(fees);
                } else {
                    // Position opened: margin locked
                    balance = balance.subtract(amount).subtract(fees);
                }
            } else {
                // Spot holding transaction
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
    // 7. USER HOLDINGS
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
    // 8. HELPER METHODS
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
