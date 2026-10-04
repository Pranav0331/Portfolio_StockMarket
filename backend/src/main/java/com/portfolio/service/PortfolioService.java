package com.portfolio.service;

import com.portfolio.dto.market.StockQuoteDto;
import com.portfolio.dto.portfolio.PortfolioSummaryDto;
import com.portfolio.dto.trading.UserHoldingDto;
import com.portfolio.entity.Holding;
import com.portfolio.entity.Stock;
import com.portfolio.repository.HoldingRepository;
import com.portfolio.repository.StockRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;

@Service
public class PortfolioService {

    private static final Logger log = LoggerFactory.getLogger(PortfolioService.class);

    private final HoldingRepository holdingRepository;
    private final StockRepository stockRepository;
    private final TradingService tradingService;

    public PortfolioService(
            HoldingRepository holdingRepository,
            StockRepository stockRepository,
            TradingService tradingService
    ) {
        this.holdingRepository = holdingRepository;
        this.stockRepository = stockRepository;
        this.tradingService = tradingService;
    }

    @Transactional
    public PortfolioSummaryDto getPortfolioSummary(Long userId) {
        BigDecimal cashBalance = tradingService.calculateCashBalance(userId);
        List<Holding> holdings = holdingRepository.findByUserId(userId);

        BigDecimal totalInvested = BigDecimal.ZERO;
        BigDecimal totalHoldingsMarketValue = BigDecimal.ZERO;

        List<HoldingCalculation> calculatedHoldings = new ArrayList<>();

        for (Holding h : holdings) {
            Stock stock = h.getStock();
            String symbol = stock != null ? stock.getSymbol() : "UNKNOWN";
            BigDecimal qty = h.getQuantity() != null ? h.getQuantity() : BigDecimal.ZERO;
            BigDecimal avgPrice = h.getAverageBuyPrice() != null ? h.getAverageBuyPrice() : BigDecimal.ZERO;
            BigDecimal invested = qty.multiply(avgPrice).setScale(4, RoundingMode.HALF_UP);

            // Fetch live real market price
            BigDecimal currentPrice = null;
            boolean priceAvailable = false;

            try {
                StockQuoteDto quote = tradingService.fetchRealMarketQuote(symbol);
                if (quote != null && quote.price() != null && quote.price().compareTo(BigDecimal.ZERO) > 0) {
                    currentPrice = quote.price();
                    priceAvailable = true;
                    // Update latest known price on stock entity
                    if (stock != null) {
                        stock.setCurrentPrice(currentPrice);
                        if (quote.previousClose() != null) {
                            stock.setPreviousClose(quote.previousClose());
                        }
                        stockRepository.save(stock);
                    }
                }
            } catch (Exception e) {
                log.warn("Could not fetch real price for holding {}: {}", symbol, e.getMessage());
            }

            if (currentPrice == null) {
                currentPrice = stock != null && stock.getCurrentPrice() != null
                        ? stock.getCurrentPrice()
                        : avgPrice;
            }

            BigDecimal currentValue = qty.multiply(currentPrice).setScale(4, RoundingMode.HALF_UP);
            BigDecimal unrealizedPnL = currentValue.subtract(invested).setScale(4, RoundingMode.HALF_UP);

            BigDecimal unrealizedPnLPercent = BigDecimal.ZERO;
            if (invested.compareTo(BigDecimal.ZERO) > 0) {
                unrealizedPnLPercent = unrealizedPnL.divide(invested, 4, RoundingMode.HALF_UP)
                        .multiply(new BigDecimal("100"))
                        .setScale(2, RoundingMode.HALF_UP);
            }

            BigDecimal prevClose = stock != null && stock.getPreviousClose() != null ? stock.getPreviousClose() : currentPrice;
            BigDecimal dayChangePerShare = currentPrice.subtract(prevClose);
            BigDecimal dayChangeTotal = dayChangePerShare.multiply(qty).setScale(4, RoundingMode.HALF_UP);

            totalInvested = totalInvested.add(invested);
            totalHoldingsMarketValue = totalHoldingsMarketValue.add(currentValue);

            calculatedHoldings.add(new HoldingCalculation(
                    h, symbol, stock != null ? stock.getCompanyName() : symbol,
                    stock != null ? stock.getExchange() : "NSE",
                    stock != null ? stock.getCurrency() : "USD",
                    qty, avgPrice, invested, currentPrice, currentValue,
                    unrealizedPnL, unrealizedPnLPercent, priceAvailable,
                    dayChangeTotal
            ));
        }

        BigDecimal totalPortfolioValue = cashBalance.add(totalHoldingsMarketValue).setScale(4, RoundingMode.HALF_UP);
        BigDecimal totalUnrealizedPnL = totalHoldingsMarketValue.subtract(totalInvested).setScale(4, RoundingMode.HALF_UP);

        BigDecimal totalUnrealizedPnLPercent = BigDecimal.ZERO;
        if (totalInvested.compareTo(BigDecimal.ZERO) > 0) {
            totalUnrealizedPnLPercent = totalUnrealizedPnL.divide(totalInvested, 4, RoundingMode.HALF_UP)
                    .multiply(new BigDecimal("100"))
                    .setScale(2, RoundingMode.HALF_UP);
        }

        BigDecimal totalTodayPnL = BigDecimal.ZERO;
        for (HoldingCalculation calc : calculatedHoldings) {
            if (calc.dayChange != null) {
                totalTodayPnL = totalTodayPnL.add(calc.dayChange);
            }
        }

        BigDecimal totalTodayPnLPercent = BigDecimal.ZERO;
        if (totalPortfolioValue.compareTo(BigDecimal.ZERO) > 0) {
            BigDecimal baseline = totalPortfolioValue.subtract(totalTodayPnL);
            if (baseline.compareTo(BigDecimal.ZERO) > 0) {
                totalTodayPnLPercent = totalTodayPnL.divide(baseline, 4, RoundingMode.HALF_UP)
                        .multiply(new BigDecimal("100"))
                        .setScale(2, RoundingMode.HALF_UP);
            }
        }

        BigDecimal cashAllocationPercent = BigDecimal.ZERO;
        if (totalPortfolioValue.compareTo(BigDecimal.ZERO) > 0) {
            cashAllocationPercent = cashBalance.divide(totalPortfolioValue, 4, RoundingMode.HALF_UP)
                    .multiply(new BigDecimal("100"))
                    .setScale(2, RoundingMode.HALF_UP);
        }

        List<UserHoldingDto> holdingDtos = new ArrayList<>();
        for (HoldingCalculation calc : calculatedHoldings) {
            BigDecimal allocationPercent = BigDecimal.ZERO;
            if (totalPortfolioValue.compareTo(BigDecimal.ZERO) > 0) {
                allocationPercent = calc.currentValue.divide(totalPortfolioValue, 4, RoundingMode.HALF_UP)
                        .multiply(new BigDecimal("100"))
                        .setScale(2, RoundingMode.HALF_UP);
            }

            holdingDtos.add(new UserHoldingDto(
                    calc.holding.getId(),
                    calc.symbol,
                    calc.companyName,
                    calc.exchange,
                    calc.currency,
                    calc.quantity.setScale(4, RoundingMode.HALF_UP),
                    calc.avgPrice.setScale(4, RoundingMode.HALF_UP),
                    calc.invested.setScale(4, RoundingMode.HALF_UP),
                    calc.currentPrice.setScale(4, RoundingMode.HALF_UP),
                    calc.currentValue.setScale(4, RoundingMode.HALF_UP),
                    calc.unrealizedPnL,
                    calc.unrealizedPnLPercent,
                    allocationPercent,
                    calc.priceAvailable
            ));
        }

        return new PortfolioSummaryDto(
                cashBalance.setScale(2, RoundingMode.HALF_UP),
                totalInvested.setScale(2, RoundingMode.HALF_UP),
                totalHoldingsMarketValue.setScale(2, RoundingMode.HALF_UP),
                totalPortfolioValue.setScale(2, RoundingMode.HALF_UP),
                totalUnrealizedPnL.setScale(2, RoundingMode.HALF_UP),
                totalUnrealizedPnLPercent,
                holdingDtos.size(),
                cashAllocationPercent,
                holdingDtos,
                totalTodayPnL.setScale(2, RoundingMode.HALF_UP),
                totalTodayPnLPercent
        );
    }

    private static class HoldingCalculation {
        final Holding holding;
        final String symbol;
        final String companyName;
        final String exchange;
        final String currency;
        final BigDecimal quantity;
        final BigDecimal avgPrice;
        final BigDecimal invested;
        final BigDecimal currentPrice;
        final BigDecimal currentValue;
        final BigDecimal unrealizedPnL;
        final BigDecimal unrealizedPnLPercent;
        final boolean priceAvailable;
        final BigDecimal dayChange;

        HoldingCalculation(
                Holding holding, String symbol, String companyName, String exchange, String currency,
                BigDecimal quantity, BigDecimal avgPrice, BigDecimal invested, BigDecimal currentPrice,
                BigDecimal currentValue, BigDecimal unrealizedPnL, BigDecimal unrealizedPnLPercent,
                boolean priceAvailable, BigDecimal dayChange
        ) {
            this.holding = holding;
            this.symbol = symbol;
            this.companyName = companyName;
            this.exchange = exchange;
            this.currency = currency;
            this.quantity = quantity;
            this.avgPrice = avgPrice;
            this.invested = invested;
            this.currentPrice = currentPrice;
            this.currentValue = currentValue;
            this.unrealizedPnL = unrealizedPnL;
            this.unrealizedPnLPercent = unrealizedPnLPercent;
            this.priceAvailable = priceAvailable;
            this.dayChange = dayChange;
        }
    }
}
