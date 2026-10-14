package com.portfolio.service;

import com.portfolio.dto.common.PageResponseDto;
import com.portfolio.dto.market.StockQuoteDto;
import com.portfolio.dto.trading.PositionDto;
import com.portfolio.dto.trading.UserHoldingDto;
import com.portfolio.dto.trading.VirtualWalletDto;
import com.portfolio.dto.transaction.AccountSummaryDto;
import com.portfolio.dto.transaction.TransactionDto;
import com.portfolio.entity.Stock;
import com.portfolio.entity.Transaction;
import com.portfolio.entity.User;
import com.portfolio.entity.enums.PositionSide;
import com.portfolio.entity.enums.PositionStatus;
import com.portfolio.entity.enums.TradingMode;
import com.portfolio.entity.enums.TransactionStatus;
import com.portfolio.entity.enums.TransactionType;
import com.portfolio.repository.TransactionRepository;
import com.portfolio.repository.UserRepository;
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
    private final TradingService tradingService;
    private final UserRepository userRepository;

    @org.springframework.beans.factory.annotation.Autowired
    public TransactionService(
            TransactionRepository transactionRepository,
            MarketDataService marketDataService,
            UpstoxService upstoxService,
            @org.springframework.context.annotation.Lazy TradingService tradingService,
            UserRepository userRepository
    ) {
        this.transactionRepository = transactionRepository;
        this.marketDataService = marketDataService;
        this.upstoxService = upstoxService;
        this.tradingService = tradingService;
        this.userRepository = userRepository;
    }

    // Convenience constructor for tests
    public TransactionService(TransactionRepository transactionRepository) {
        this(transactionRepository, null, null, null, null);
    }

    public TransactionService(
            TransactionRepository transactionRepository,
            MarketDataService marketDataService,
            UpstoxService upstoxService
    ) {
        this(transactionRepository, marketDataService, upstoxService, null, null);
    }

    @Transactional(readOnly = true)
    public PageResponseDto<TransactionDto> getUserTransactions(
            Long userId,
            boolean financialOnly,
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

        log.debug("Fetching transactions for user {}: financialOnly={}, type={}, mode={}, symbol={}, startDate={}, endDate={}, page={}, size={}",
                userId, financialOnly, transactionType, mode, cleanSymbol, startDate, endDate, pageIndex, pageSize);

        Page<Transaction> transactionPage = financialOnly
                ? transactionRepository.findUserTransactions(userId, true, transactionType, mode, cleanSymbol, startDate, endDate, pageable)
                : transactionRepository.findUserTransactions(userId, transactionType, mode, cleanSymbol, startDate, endDate, pageable);

        Map<String, BigDecimal> currentPricesCache = new HashMap<>();
        Map<Long, RunningTxInfo> runningInfoMap = computeRunningLedgerInfo(userId);

        List<TransactionDto> dtoList = transactionPage.getContent().stream()
                .map(t -> mapToDto(t, currentPricesCache, runningInfoMap))
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
            String tradingMode,
            String symbol,
            Instant startDate,
            Instant endDate,
            int page,
            int size,
            String sortDirection
    ) {
        return getUserTransactions(userId, false, type, tradingMode, symbol, startDate, endDate, page, size, sortDirection);
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
        return getUserTransactions(userId, false, type, null, symbol, startDate, endDate, page, size, sortDirection);
    }

    @Transactional(readOnly = true)
    public AccountSummaryDto getAccountSummary(Long userId) {
        if (userId == null) {
            throw new IllegalArgumentException("User ID must not be null");
        }

        User user = userRepository != null ? userRepository.findById(userId).orElse(null) : null;
        List<Transaction> allTransactions = transactionRepository.findByUserIdOrderByCreatedAtAscIdAsc(userId);

        Transaction initTx = null;
        BigDecimal totalDeposited = BigDecimal.ZERO;
        BigDecimal totalWithdrawn = BigDecimal.ZERO;
        BigDecimal totalRealizedPnl = BigDecimal.ZERO;
        int totalTradesCount = 0;

        for (Transaction t : allTransactions) {
            if (t.getStatus() != TransactionStatus.SUCCESS) continue;

            if (t.getTransactionType() == TransactionType.ACCOUNT_INIT && initTx == null) {
                initTx = t;
            } else if (t.getTransactionType() == TransactionType.DEPOSIT) {
                totalDeposited = totalDeposited.add(t.getTotalAmount() != null ? t.getTotalAmount() : BigDecimal.ZERO);
            } else if (t.getTransactionType() == TransactionType.WITHDRAWAL) {
                totalWithdrawn = totalWithdrawn.add(t.getTotalAmount() != null ? t.getTotalAmount() : BigDecimal.ZERO);
            } else if (t.getTransactionType() == TransactionType.BUY || t.getTransactionType() == TransactionType.SELL) {
                totalTradesCount++;
                if (t.getPnl() != null) {
                    totalRealizedPnl = totalRealizedPnl.add(t.getPnl());
                }
            }
        }

        BigDecimal initialFundingAmount = null;
        boolean initialFundingRecorded = false;
        Instant initialFundingTime = null;

        if (initTx != null) {
            initialFundingAmount = initTx.getTotalAmount() != null ? initTx.getTotalAmount().setScale(2, RoundingMode.HALF_UP) : null;
            initialFundingRecorded = true;
            initialFundingTime = initTx.getCreatedAt();
        }

        BigDecimal currentCashBalance = BigDecimal.ZERO;
        BigDecimal accountEquity = BigDecimal.ZERO;
        BigDecimal marginUsed = BigDecimal.ZERO;
        BigDecimal floatingPnl = BigDecimal.ZERO;
        BigDecimal spotHoldingsMarketValue = BigDecimal.ZERO;
        BigDecimal spotHoldingsInvested = BigDecimal.ZERO;
        int openPositionsCount = 0;

        if (tradingService != null) {
            VirtualWalletDto wallet = tradingService.getWallet(userId);
            if (wallet != null) {
                currentCashBalance = wallet.cashBalance() != null ? wallet.cashBalance() : BigDecimal.ZERO;
                accountEquity = wallet.totalPortfolioValue() != null ? wallet.totalPortfolioValue() : BigDecimal.ZERO;
                marginUsed = wallet.marginUsed() != null ? wallet.marginUsed() : BigDecimal.ZERO;
                floatingPnl = wallet.floatingPnl() != null ? wallet.floatingPnl() : BigDecimal.ZERO;
            }

            List<UserHoldingDto> holdings = tradingService.getUserHoldings(userId);
            if (holdings != null) {
                for (UserHoldingDto h : holdings) {
                    if (h.currentValue() != null) {
                        spotHoldingsMarketValue = spotHoldingsMarketValue.add(h.currentValue());
                    }
                    if (h.totalInvested() != null) {
                        spotHoldingsInvested = spotHoldingsInvested.add(h.totalInvested());
                    }
                }
                openPositionsCount += holdings.size();
            }

            List<PositionDto> openPositions = tradingService.getUserPositions(userId, null, PositionStatus.OPEN);
            if (openPositions != null) {
                openPositionsCount += openPositions.size();
            }
        } else {
            currentCashBalance = (user != null && user.getVirtualBalance() != null) ? user.getVirtualBalance() : BigDecimal.valueOf(100000);
            accountEquity = currentCashBalance;
        }

        BigDecimal spotUnrealizedPnl = spotHoldingsMarketValue.subtract(spotHoldingsInvested);
        BigDecimal totalUnrealizedPnl = spotUnrealizedPnl.add(floatingPnl).setScale(2, RoundingMode.HALF_UP);
        BigDecimal overallTradingPnl = totalRealizedPnl.add(totalUnrealizedPnl).setScale(2, RoundingMode.HALF_UP);

        return new AccountSummaryDto(
                initialFundingAmount,
                initialFundingRecorded,
                initialFundingTime,
                totalDeposited.setScale(2, RoundingMode.HALF_UP),
                totalWithdrawn.setScale(2, RoundingMode.HALF_UP),
                currentCashBalance.setScale(2, RoundingMode.HALF_UP),
                totalRealizedPnl.setScale(2, RoundingMode.HALF_UP),
                totalUnrealizedPnl,
                overallTradingPnl,
                accountEquity.setScale(2, RoundingMode.HALF_UP),
                marginUsed.setScale(2, RoundingMode.HALF_UP),
                spotHoldingsMarketValue.setScale(2, RoundingMode.HALF_UP),
                totalTradesCount,
                openPositionsCount
        );
    }

    private record RunningTxInfo(BigDecimal balance, String description) {}

    private Map<Long, RunningTxInfo> computeRunningLedgerInfo(Long userId) {
        Map<Long, RunningTxInfo> map = new HashMap<>();
        User user = userRepository != null ? userRepository.findById(userId).orElse(null) : null;
        BigDecimal runningBalance = (user != null && user.getVirtualBalance() != null)
                ? user.getVirtualBalance()
                : BigDecimal.valueOf(100000);

        List<Transaction> chronList = transactionRepository.findByUserIdOrderByCreatedAtAscIdAsc(userId);

        for (Transaction t : chronList) {
            if (t.getStatus() != TransactionStatus.SUCCESS) {
                map.put(t.getId(), new RunningTxInfo(runningBalance.setScale(2, RoundingMode.HALF_UP), "Transaction " + t.getStatus()));
                continue;
            }

            BigDecimal amount = t.getTotalAmount() != null ? t.getTotalAmount() : BigDecimal.ZERO;
            BigDecimal fees = t.getFees() != null ? t.getFees() : BigDecimal.ZERO;
            String symbol = t.getStock() != null ? t.getStock().getSymbol() : "Cash";
            String description;

            if (t.getTransactionType() == TransactionType.ACCOUNT_INIT) {
                runningBalance = amount;
                description = "Initial virtual cash credited on account creation";
            } else if (t.getTransactionType() == TransactionType.ACCOUNT_RESET) {
                runningBalance = amount;
                description = "Paper trading account balance reset to $" + formatNumber(amount);
            } else if (t.getTransactionType() == TransactionType.DEPOSIT) {
                runningBalance = runningBalance.add(amount).subtract(fees);
                description = "Virtual cash deposit";
            } else if (t.getTransactionType() == TransactionType.WITHDRAWAL) {
                runningBalance = runningBalance.subtract(amount).subtract(fees);
                description = "Virtual cash withdrawal";
            } else if (t.getTransactionType() == TransactionType.DIVIDEND) {
                runningBalance = runningBalance.add(amount).subtract(fees);
                description = "Cash dividend payout for " + symbol;
            } else if (t.getPositionId() != null) {
                // Margined trade
                boolean isClose = (t.getPositionSide() == PositionSide.LONG && t.getTransactionType() == TransactionType.SELL)
                        || (t.getPositionSide() == PositionSide.SHORT && t.getTransactionType() == TransactionType.BUY);
                if (isClose) {
                    runningBalance = runningBalance.add(amount).subtract(fees);
                    String pnlStr = (t.getPnl() != null && t.getPnl().compareTo(BigDecimal.ZERO) >= 0 ? "+$" : "-$")
                            + formatNumber(t.getPnl() != null ? t.getPnl().abs() : BigDecimal.ZERO);
                    description = "Closed " + (t.getPositionSide() != null ? t.getPositionSide().name() : "position")
                            + " on " + symbol + " (P&L: " + pnlStr + ")";
                } else {
                    runningBalance = runningBalance.subtract(amount).subtract(fees);
                    description = "Opened " + (t.getPositionSide() != null ? t.getPositionSide().name() : "position")
                            + " (" + (t.getLeverage() != null ? t.getLeverage() : 1) + "x) on " + symbol;
                }
            } else {
                // Spot holding trade
                if (t.getTransactionType() == TransactionType.BUY) {
                    runningBalance = runningBalance.subtract(amount).subtract(fees);
                    description = "Bought " + formatQuantity(t.getQuantity()) + " " + symbol
                            + " @ $" + formatNumber(t.getPricePerUnit() != null ? t.getPricePerUnit() : BigDecimal.ZERO);
                } else if (t.getTransactionType() == TransactionType.SELL) {
                    runningBalance = runningBalance.add(amount).subtract(fees);
                    String pnlStr = (t.getPnl() != null && t.getPnl().compareTo(BigDecimal.ZERO) >= 0 ? "+$" : "-$")
                            + formatNumber(t.getPnl() != null ? t.getPnl().abs() : BigDecimal.ZERO);
                    description = "Sold " + formatQuantity(t.getQuantity()) + " " + symbol
                            + " @ $" + formatNumber(t.getPricePerUnit() != null ? t.getPricePerUnit() : BigDecimal.ZERO)
                            + " (Realized P&L: " + pnlStr + ")";
                } else {
                    description = t.getTransactionType() != null ? t.getTransactionType().name() : "Transaction";
                }
            }

            map.put(t.getId(), new RunningTxInfo(runningBalance.setScale(2, RoundingMode.HALF_UP), description));
        }

        return map;
    }

    private String formatNumber(BigDecimal val) {
        if (val == null) return "0.00";
        return val.setScale(2, RoundingMode.HALF_UP).toPlainString();
    }

    private String formatQuantity(BigDecimal val) {
        if (val == null) return "0";
        return val.stripTrailingZeros().toPlainString();
    }

    private TransactionDto mapToDto(Transaction t, Map<String, BigDecimal> currentPricesCache, Map<Long, RunningTxInfo> runningInfoMap) {
        Stock stock = t.getStock();
        String symbol;
        String companyName;
        String exchange;
        String currency;

        if (stock != null) {
            symbol = (stock.getSymbol() != null && !stock.getSymbol().isBlank()) ? stock.getSymbol() : "ASSET";
            companyName = (stock.getCompanyName() != null && !stock.getCompanyName().isBlank()) ? stock.getCompanyName() : symbol;
            exchange = (stock.getExchange() != null && !stock.getExchange().isBlank()) ? stock.getExchange() : "NSE";
            currency = (stock.getCurrency() != null && !stock.getCurrency().isBlank()) ? stock.getCurrency() : "USD";
        } else {
            exchange = "CASH";
            currency = "USD";
            TransactionType type = t.getTransactionType();
            if (type == TransactionType.DEPOSIT) {
                symbol = "DEPOSIT";
                companyName = "Cash Deposit";
            } else if (type == TransactionType.WITHDRAWAL) {
                symbol = "WITHDRAWAL";
                companyName = "Cash Withdrawal";
            } else if (type == TransactionType.DIVIDEND) {
                symbol = "DIVIDEND";
                companyName = "Cash Dividend";
            } else if (type == TransactionType.ACCOUNT_INIT) {
                symbol = "INIT";
                companyName = "Initial Virtual Cash";
            } else if (type == TransactionType.ACCOUNT_RESET) {
                symbol = "RESET";
                companyName = "Account Balance Reset";
            } else if (type != null) {
                symbol = type.name();
                companyName = type.name().replace("_", " ");
            } else {
                symbol = "CASH";
                companyName = "Cash Adjustment";
            }
        }

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
        if (executionPrice == null && t.getTotalAmount() != null) {
            executionPrice = t.getTotalAmount();
        }
        if (executionPrice == null) {
            executionPrice = BigDecimal.ZERO;
        }

        BigDecimal quantity = t.getQuantity() != null ? t.getQuantity() : (stock == null ? BigDecimal.ONE : BigDecimal.ZERO);
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

        RunningTxInfo runningInfo = runningInfoMap != null ? runningInfoMap.get(t.getId()) : null;
        BigDecimal balanceAfterEvent = runningInfo != null ? runningInfo.balance() : null;
        String description = runningInfo != null ? runningInfo.description() : null;

        String cashFlowImpact;
        String cashFlowImpactLabel;
        TransactionType tType = t.getTransactionType();
        if (tType == TransactionType.DEPOSIT || tType == TransactionType.ACCOUNT_INIT || tType == TransactionType.DIVIDEND) {
            cashFlowImpact = "CREDIT";
            cashFlowImpactLabel = "+ Increases Cash";
        } else if (tType == TransactionType.WITHDRAWAL) {
            cashFlowImpact = "DEBIT";
            cashFlowImpactLabel = "- Decreases Cash";
        } else if (tType == TransactionType.ACCOUNT_RESET) {
            cashFlowImpact = "RESET";
            cashFlowImpactLabel = "= Resets Cash Balance";
        } else if (tType == TransactionType.SELL) {
            cashFlowImpact = "CREDIT";
            cashFlowImpactLabel = "+ Realized Return";
        } else if (tType == TransactionType.BUY) {
            cashFlowImpact = "DEBIT";
            cashFlowImpactLabel = "- Trade Outflow";
        } else {
            cashFlowImpact = "ADJUSTMENT";
            cashFlowImpactLabel = "Account Adjustment";
        }

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
                currentPrice,
                balanceAfterEvent,
                description,
                cashFlowImpact,
                cashFlowImpactLabel
        );
    }

    private BigDecimal getRealCurrentPrice(String symbol, Stock stock, Map<String, BigDecimal> cache) {
        if (symbol == null || symbol.isBlank()
                || "UNKNOWN".equalsIgnoreCase(symbol)
                || "CASH".equalsIgnoreCase(symbol)
                || "DEPOSIT".equalsIgnoreCase(symbol)
                || "WITHDRAWAL".equalsIgnoreCase(symbol)
                || "DIVIDEND".equalsIgnoreCase(symbol)) {
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
