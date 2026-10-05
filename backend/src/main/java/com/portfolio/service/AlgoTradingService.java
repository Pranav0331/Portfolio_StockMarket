package com.portfolio.service;

import com.portfolio.dto.algo.*;
import com.portfolio.dto.market.CandleDto;
import com.portfolio.dto.market.CandleSeriesDto;
import com.portfolio.dto.trading.PositionDto;
import com.portfolio.dto.trading.TradeRequestDto;
import com.portfolio.dto.trading.TradeResponseDto;
import com.portfolio.entity.AlgoStrategy;
import com.portfolio.entity.AlgoTradeLog;
import com.portfolio.entity.User;
import com.portfolio.entity.enums.*;
import com.portfolio.repository.AlgoStrategyRepository;
import com.portfolio.repository.AlgoTradeLogRepository;
import com.portfolio.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Service
public class AlgoTradingService {

    private static final Logger log = LoggerFactory.getLogger(AlgoTradingService.class);

    private final AlgoStrategyRepository strategyRepository;
    private final AlgoTradeLogRepository tradeLogRepository;
    private final UserRepository userRepository;
    private final MarketDataService marketDataService;
    private final TradingService tradingService;

    public AlgoTradingService(AlgoStrategyRepository strategyRepository,
                              AlgoTradeLogRepository tradeLogRepository,
                              UserRepository userRepository,
                              MarketDataService marketDataService,
                              TradingService tradingService) {
        this.strategyRepository = strategyRepository;
        this.tradeLogRepository = tradeLogRepository;
        this.userRepository = userRepository;
        this.marketDataService = marketDataService;
        this.tradingService = tradingService;
    }

    @Transactional
    public AlgoStrategyResponseDto createStrategy(Long userId, AlgoStrategyRequestDto request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        AlgoStrategy strategy = new AlgoStrategy();
        strategy.setUser(user);
        mapRequestToStrategy(request, strategy);
        strategy.setStatus(StrategyStatus.STOPPED);

        AlgoStrategy saved = strategyRepository.save(strategy);
        return AlgoStrategyResponseDto.fromEntity(saved);
    }

    @Transactional(readOnly = true)
    public List<AlgoStrategyResponseDto> getUserStrategies(Long userId) {
        return strategyRepository.findByUserIdOrderByCreatedAtDesc(userId)
                .stream()
                .map(AlgoStrategyResponseDto::fromEntity)
                .toList();
    }

    @Transactional(readOnly = true)
    public AlgoStrategyResponseDto getStrategy(Long userId, Long strategyId) {
        AlgoStrategy strategy = strategyRepository.findByIdAndUserId(strategyId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Strategy not found"));
        return AlgoStrategyResponseDto.fromEntity(strategy);
    }

    @Transactional
    public AlgoStrategyResponseDto updateStrategy(Long userId, Long strategyId, AlgoStrategyRequestDto request) {
        AlgoStrategy strategy = strategyRepository.findByIdAndUserId(strategyId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Strategy not found"));

        mapRequestToStrategy(request, strategy);
        AlgoStrategy updated = strategyRepository.save(strategy);
        return AlgoStrategyResponseDto.fromEntity(updated);
    }

    @Transactional
    public void deleteStrategy(Long userId, Long strategyId) {
        AlgoStrategy strategy = strategyRepository.findByIdAndUserId(strategyId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Strategy not found"));
        strategyRepository.delete(strategy);
    }

    @Transactional
    public AlgoStrategyResponseDto startStrategy(Long userId, Long strategyId) {
        AlgoStrategy strategy = strategyRepository.findByIdAndUserId(strategyId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Strategy not found"));

        strategy.setStatus(StrategyStatus.RUNNING);
        AlgoStrategy saved = strategyRepository.save(strategy);
        return AlgoStrategyResponseDto.fromEntity(saved);
    }

    @Transactional
    public AlgoStrategyResponseDto pauseStrategy(Long userId, Long strategyId) {
        AlgoStrategy strategy = strategyRepository.findByIdAndUserId(strategyId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Strategy not found"));

        strategy.setStatus(StrategyStatus.PAUSED);
        AlgoStrategy saved = strategyRepository.save(strategy);
        return AlgoStrategyResponseDto.fromEntity(saved);
    }

    @Transactional
    public AlgoStrategyResponseDto stopStrategy(Long userId, Long strategyId) {
        AlgoStrategy strategy = strategyRepository.findByIdAndUserId(strategyId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Strategy not found"));

        strategy.setStatus(StrategyStatus.STOPPED);
        AlgoStrategy saved = strategyRepository.save(strategy);
        return AlgoStrategyResponseDto.fromEntity(saved);
    }

    @Transactional(readOnly = true)
    public List<AlgoTradeLogDto> getStrategyTrades(Long userId, Long strategyId) {
        strategyRepository.findByIdAndUserId(strategyId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Strategy not found"));

        return tradeLogRepository.findByStrategyIdOrderByCreatedAtDesc(strategyId)
                .stream()
                .map(AlgoTradeLogDto::fromEntity)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<AlgoTradeLogDto> getUserTrades(Long userId) {
        return tradeLogRepository.findTop50ByUserIdOrderByCreatedAtDesc(userId)
                .stream()
                .map(AlgoTradeLogDto::fromEntity)
                .toList();
    }

    @Transactional(readOnly = true)
    public AlgoPerformanceDto getStrategyPerformance(Long userId, Long strategyId) {
        AlgoStrategy strategy = strategyRepository.findByIdAndUserId(strategyId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Strategy not found"));

        List<AlgoTradeLog> trades = tradeLogRepository.findByStrategyIdOrderByCreatedAtDesc(strategyId);

        int total = strategy.getTotalTrades();
        int wins = strategy.getWinningTrades();
        int losses = strategy.getLosingTrades();

        BigDecimal winRate = total > 0
                ? BigDecimal.valueOf((double) wins / total * 100).setScale(2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        BigDecimal totalPnl = strategy.getTotalPnl();

        BigDecimal totalWinAmt = BigDecimal.ZERO;
        BigDecimal totalLossAmt = BigDecimal.ZERO;
        for (AlgoTradeLog t : trades) {
            if (t.getPnl() != null) {
                if (t.getPnl().compareTo(BigDecimal.ZERO) > 0) {
                    totalWinAmt = totalWinAmt.add(t.getPnl());
                } else if (t.getPnl().compareTo(BigDecimal.ZERO) < 0) {
                    totalLossAmt = totalLossAmt.add(t.getPnl().abs());
                }
            }
        }

        BigDecimal avgProfit = wins > 0 ? totalWinAmt.divide(BigDecimal.valueOf(wins), 2, RoundingMode.HALF_UP) : BigDecimal.ZERO;
        BigDecimal avgLoss = losses > 0 ? totalLossAmt.divide(BigDecimal.valueOf(losses), 2, RoundingMode.HALF_UP) : BigDecimal.ZERO;
        BigDecimal profitFactor = totalLossAmt.compareTo(BigDecimal.ZERO) > 0
                ? totalWinAmt.divide(totalLossAmt, 2, RoundingMode.HALF_UP)
                : (totalWinAmt.compareTo(BigDecimal.ZERO) > 0 ? new BigDecimal("99.99") : BigDecimal.ZERO);

        return new AlgoPerformanceDto(
                strategyId,
                total,
                wins,
                losses,
                winRate,
                totalPnl,
                avgProfit,
                avgLoss,
                profitFactor,
                strategy.getMaxDrawdown()
        );
    }

    /**
     * Evaluates real market data for a strategy and optionally executes paper trade
     */
    @Transactional
    public AlgoEvaluationResponseDto evaluateStrategy(Long userId, Long strategyId, boolean executeIfSatisfied) {
        AlgoStrategy strategy = strategyRepository.findByIdAndUserId(strategyId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Strategy not found"));

        return doEvaluate(userId, strategy, executeIfSatisfied);
    }

    /**
     * Evaluates real market data for ad-hoc / unsaved strategy configuration
     */
    @Transactional
    public AlgoEvaluationResponseDto evaluateAdHoc(Long userId, AlgoStrategyRequestDto request) {
        AlgoStrategy tempStrategy = new AlgoStrategy();
        mapRequestToStrategy(request, tempStrategy);
        tempStrategy.setStatus(StrategyStatus.STOPPED);
        return doEvaluate(userId, tempStrategy, false);
    }

    private AlgoEvaluationResponseDto doEvaluate(Long userId, AlgoStrategy strategy, boolean executeIfSatisfied) {
        String symbol = strategy.getSymbol();
        String timeframe = strategy.getTimeframe() != null ? strategy.getTimeframe() : "5min";

        // 1. Fetch real market candles from existing Spring Boot provider routing
        CandleSeriesDto candleSeries = marketDataService.getCandles(symbol, timeframe, 80);
        if (candleSeries == null || candleSeries.getCandles() == null || candleSeries.getCandles().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "AI analysis unavailable — market data unavailable.");
        }

        List<CandleDto> candles = candleSeries.getCandles();
        if (candles.size() < 25) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Insufficient real historical data for AI indicator evaluation.");
        }

        double[] closes = candles.stream()
                .mapToDouble(c -> c.getClose() != null ? c.getClose().doubleValue() : 0.0)
                .toArray();
        double currentPrice = closes[closes.length - 1];
        BigDecimal curPriceBd = BigDecimal.valueOf(currentPrice).setScale(4, RoundingMode.HALF_UP);

        // 2. Calculate Indicators on real candle series
        double[] emaFast = calculateEma(closes, strategy.getEmaFastPeriod());
        double[] emaSlow = calculateEma(closes, strategy.getEmaSlowPeriod());
        double[] rsi = calculateRsi(closes, strategy.getRsiPeriod());
        double[][] macd = calculateMacd(closes, strategy.getMacdFast(), strategy.getMacdSlow(), strategy.getMacdSignal());
        double[][] bb = calculateBollingerBands(closes, strategy.getBbPeriod(), strategy.getBbStdDev().doubleValue());

        int lastIdx = closes.length - 1;
        int prevIdx = closes.length - 2;

        double currentEmaFast = emaFast[lastIdx];
        double currentEmaSlow = emaSlow[lastIdx];
        double prevEmaFast = emaFast[prevIdx];
        double prevEmaSlow = emaSlow[prevIdx];

        double currentRsi = rsi[lastIdx];
        double currentMacdHist = macd[2][lastIdx];
        double prevMacdHist = macd[2][prevIdx];

        double bbUpper = bb[0][lastIdx];
        double bbMiddle = bb[1][lastIdx];
        double bbLower = bb[2][lastIdx];

        List<String> reasons = new ArrayList<>();
        List<String> activeIndicators = new ArrayList<>();

        // 3. Evaluate Conditions
        boolean emaBullishCross = currentEmaFast > currentEmaSlow;
        boolean emaFreshCrossUp = prevEmaFast <= prevEmaSlow && currentEmaFast > currentEmaSlow;
        boolean emaBearishCross = currentEmaFast < currentEmaSlow;
        boolean emaFreshCrossDown = prevEmaFast >= prevEmaSlow && currentEmaFast < currentEmaSlow;

        boolean rsiBullish = currentRsi > strategy.getRsiOversold().doubleValue() && currentRsi <= strategy.getRsiOverbought().doubleValue();
        boolean rsiBearish = currentRsi < strategy.getRsiOverbought().doubleValue() && currentRsi >= strategy.getRsiOversold().doubleValue();

        boolean macdBullish = currentMacdHist > 0;
        boolean macdBearish = currentMacdHist < 0;

        boolean bbBullish = currentPrice <= bbLower || (currentPrice > bbLower && closes[prevIdx] <= bb[2][prevIdx]);
        boolean bbBearish = currentPrice >= bbUpper || (currentPrice < bbUpper && closes[prevIdx] >= bb[0][prevIdx]);

        int longScore = 0;
        int longTotal = 0;
        int shortScore = 0;
        int shortTotal = 0;

        if (strategy.isUseEmaCross()) {
            longTotal++;
            shortTotal++;
            activeIndicators.add(String.format("EMA(%d/%d)", strategy.getEmaFastPeriod(), strategy.getEmaSlowPeriod()));
            if (emaBullishCross) {
                longScore++;
                reasons.add(String.format("EMA %d (%.2f) is above EMA %d (%.2f) [Bullish]", strategy.getEmaFastPeriod(), currentEmaFast, strategy.getEmaSlowPeriod(), currentEmaSlow));
            } else {
                shortScore++;
                reasons.add(String.format("EMA %d (%.2f) is below EMA %d (%.2f) [Bearish]", strategy.getEmaFastPeriod(), currentEmaFast, strategy.getEmaSlowPeriod(), currentEmaSlow));
            }
        }

        if (strategy.isUseRsiFilter()) {
            longTotal++;
            shortTotal++;
            activeIndicators.add(String.format("RSI(%d)", strategy.getRsiPeriod()));
            if (rsiBullish) {
                longScore++;
                reasons.add(String.format("RSI is %.1f (Healthy Bullish Momentum)", currentRsi));
            } else if (currentRsi > strategy.getRsiOverbought().doubleValue()) {
                shortScore++;
                reasons.add(String.format("RSI is %.1f (Overbought territory > %.0f)", currentRsi, strategy.getRsiOverbought().doubleValue()));
            } else {
                reasons.add(String.format("RSI is %.1f (Oversold territory < %.0f)", currentRsi, strategy.getRsiOversold().doubleValue()));
            }
        }

        if (strategy.isUseMacdFilter()) {
            longTotal++;
            shortTotal++;
            activeIndicators.add(String.format("MACD(%d,%d,%d)", strategy.getMacdFast(), strategy.getMacdSlow(), strategy.getMacdSignal()));
            if (macdBullish) {
                longScore++;
                reasons.add(String.format("MACD Histogram is positive (+%.2f) [Upward Acceleration]", currentMacdHist));
            } else {
                shortScore++;
                reasons.add(String.format("MACD Histogram is negative (%.2f) [Downward Acceleration]", currentMacdHist));
            }
        }

        if (strategy.isUseBbFilter()) {
            longTotal++;
            shortTotal++;
            activeIndicators.add(String.format("BB(%d,%.1f)", strategy.getBbPeriod(), strategy.getBbStdDev().doubleValue()));
            if (bbBullish) {
                longScore++;
                reasons.add(String.format("Price (%.2f) testing Lower Bollinger Band (%.2f)", currentPrice, bbLower));
            } else if (bbBearish) {
                shortScore++;
                reasons.add(String.format("Price (%.2f) testing Upper Bollinger Band (%.2f)", currentPrice, bbUpper));
            }
        }

        // Determine AI Trend, Signal and Confidence
        String trend;
        AlgoSignal signal = AlgoSignal.WAIT;
        double confidenceVal = 50.0;

        if (longScore > shortScore && longScore >= 2) {
            trend = "BULLISH";
        } else if (shortScore > longScore && shortScore >= 2) {
            trend = "BEARISH";
        } else {
            trend = "NEUTRAL";
        }

        StrategyDirection direction = strategy.getDirection() != null ? strategy.getDirection() : StrategyDirection.BOTH;

        if ((direction == StrategyDirection.LONG || direction == StrategyDirection.BOTH)
                && longTotal > 0 && longScore == longTotal) {
            signal = AlgoSignal.BUY;
            confidenceVal = Math.min(95.0, 75.0 + (emaFreshCrossUp ? 15.0 : 5.0) + (macdBullish ? 5.0 : 0.0));
        } else if ((direction == StrategyDirection.SHORT || direction == StrategyDirection.BOTH)
                && shortTotal > 0 && shortScore == shortTotal) {
            signal = AlgoSignal.SELL;
            confidenceVal = Math.min(95.0, 75.0 + (emaFreshCrossDown ? 15.0 : 5.0) + (macdBearish ? 5.0 : 0.0));
        } else {
            signal = AlgoSignal.WAIT;
            confidenceVal = Math.max(35.0, 50.0 - Math.abs(longScore - shortScore) * 5.0);
            if (reasons.isEmpty()) {
                reasons.add("Market in consolidation / No clear signal confluence");
            }
        }

        String riskLevel = confidenceVal >= 80 ? "LOW" : (confidenceVal >= 60 ? "MODERATE" : "HIGH");

        // Risk & Position Sizing Analytics
        BigDecimal leverageBd = BigDecimal.valueOf(strategy.getLeverage() > 0 ? strategy.getLeverage() : 1);
        BigDecimal positionSizeBd = curPriceBd.multiply(strategy.getQuantity()).setScale(2, RoundingMode.HALF_UP);
        BigDecimal requiredMarginBd = positionSizeBd.divide(leverageBd, 2, RoundingMode.HALF_UP);

        BigDecimal maxRiskAmountBd = strategy.getStopLossPct() != null
                ? positionSizeBd.multiply(strategy.getStopLossPct()).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP)
                : requiredMarginBd;

        boolean tradeExecuted = false;
        String executionMessage = null;
        Long orderId = null;
        Long positionId = null;

        // 4. If Strategy is RUNNING and executeIfSatisfied is true -> Trigger Paper Trade Execution
        if (executeIfSatisfied && strategy.getStatus() == StrategyStatus.RUNNING && (signal == AlgoSignal.BUY || signal == AlgoSignal.SELL)) {
            // Check open positions count
            List<PositionDto> openPositions = tradingService.getUserPositions(userId, symbol, PositionStatus.OPEN);
            if (openPositions.size() < strategy.getMaxOpenPositions()) {
                try {
                    // Compute dynamic Stop Loss and Take Profit prices if percentage specified
                    BigDecimal slPrice = null;
                    if (strategy.getStopLossPct() != null && strategy.getStopLossPct().compareTo(BigDecimal.ZERO) > 0) {
                        if (signal == AlgoSignal.BUY) {
                            slPrice = curPriceBd.multiply(BigDecimal.ONE.subtract(strategy.getStopLossPct().divide(BigDecimal.valueOf(100), 4, RoundingMode.HALF_UP))).setScale(2, RoundingMode.HALF_UP);
                        } else {
                            slPrice = curPriceBd.multiply(BigDecimal.ONE.add(strategy.getStopLossPct().divide(BigDecimal.valueOf(100), 4, RoundingMode.HALF_UP))).setScale(2, RoundingMode.HALF_UP);
                        }
                    }

                    BigDecimal tpPrice = null;
                    if (strategy.getTakeProfitPct() != null && strategy.getTakeProfitPct().compareTo(BigDecimal.ZERO) > 0) {
                        if (signal == AlgoSignal.BUY) {
                            tpPrice = curPriceBd.multiply(BigDecimal.ONE.add(strategy.getTakeProfitPct().divide(BigDecimal.valueOf(100), 4, RoundingMode.HALF_UP))).setScale(2, RoundingMode.HALF_UP);
                        } else {
                            tpPrice = curPriceBd.multiply(BigDecimal.ONE.subtract(strategy.getTakeProfitPct().divide(BigDecimal.valueOf(100), 4, RoundingMode.HALF_UP))).setScale(2, RoundingMode.HALF_UP);
                        }
                    }

                    TradeRequestDto tradeRequest = new TradeRequestDto(
                            symbol,
                            strategy.getQuantity(),
                            strategy.getTradingMode(),
                            signal == AlgoSignal.BUY ? PositionSide.LONG : PositionSide.SHORT,
                            strategy.getLeverage(),
                            slPrice,
                            tpPrice
                    );

                    TradeResponseDto tradeResponse;
                    if (signal == AlgoSignal.BUY) {
                        tradeResponse = tradingService.executeBuy(userId, tradeRequest);
                    } else {
                        tradeResponse = tradingService.executeSell(userId, tradeRequest);
                    }

                    tradeExecuted = true;
                    orderId = tradeResponse.orderId();
                    positionId = tradeResponse.positionId();
                    executionMessage = String.format("Auto-executed %s %s %.2f LOT at $%.2f (Leverage 1:%d)",
                            signal, symbol, strategy.getQuantity(), currentPrice, strategy.getLeverage());

                    strategy.setTotalTrades(strategy.getTotalTrades() + 1);

                } catch (Exception e) {
                    log.warn("Algo auto-execution failed for strategy {}: {}", strategy.getId(), e.getMessage());
                    executionMessage = "Auto-execution failed: " + e.getMessage();
                }
            } else {
                executionMessage = "Max open positions reached (" + openPositions.size() + "/" + strategy.getMaxOpenPositions() + "). Skipping execution.";
            }
        }

        // 5. Record Execution Log & Update Strategy Status
        strategy.setLastRunAt(LocalDateTime.now());
        strategy.setLastSignal(signal.name());
        strategy.setLastSignalReasons(String.join("; ", reasons));
        if (strategy.getId() != null) {
            strategyRepository.save(strategy);

            AlgoTradeLog logEntry = new AlgoTradeLog();
            logEntry.setStrategy(strategy);
            logEntry.setUser(strategy.getUser() != null ? strategy.getUser() : userRepository.getReferenceById(userId));
            logEntry.setSymbol(symbol);
            logEntry.setAction(tradeExecuted ? signal.name() : (signal == AlgoSignal.WAIT ? "WAIT" : "SKIPPED"));
            logEntry.setPrice(curPriceBd);
            logEntry.setQuantity(strategy.getQuantity());
            logEntry.setSignal(signal.name());
            logEntry.setConfidence(BigDecimal.valueOf(confidenceVal).setScale(2, RoundingMode.HALF_UP));
            logEntry.setTrend(trend);
            logEntry.setReasons(String.join("; ", reasons));
            logEntry.setOrderId(orderId);
            logEntry.setPositionId(positionId);
            logEntry.setStatus(tradeExecuted ? "EXECUTED" : (signal == AlgoSignal.WAIT ? "EVALUATED" : "SKIPPED"));
            tradeLogRepository.save(logEntry);
        }

        return new AlgoEvaluationResponseDto(
                strategy.getId(),
                symbol,
                curPriceBd,
                trend,
                signal,
                BigDecimal.valueOf(confidenceVal).setScale(2, RoundingMode.HALF_UP),
                reasons,
                activeIndicators,
                riskLevel,
                tradeExecuted,
                executionMessage,
                orderId,
                positionId,
                requiredMarginBd,
                positionSizeBd,
                maxRiskAmountBd,
                LocalDateTime.now()
        );
    }

    private void mapRequestToStrategy(AlgoStrategyRequestDto req, AlgoStrategy s) {
        if (req.name() != null) s.setName(req.name());
        if (req.symbol() != null) s.setSymbol(req.symbol().trim().toUpperCase());
        if (req.market() != null) s.setMarket(req.market());
        if (req.tradingMode() != null) s.setTradingMode(req.tradingMode());
        if (req.timeframe() != null) s.setTimeframe(req.timeframe());
        if (req.direction() != null) s.setDirection(req.direction());

        if (req.emaFastPeriod() != null) s.setEmaFastPeriod(req.emaFastPeriod());
        if (req.emaSlowPeriod() != null) s.setEmaSlowPeriod(req.emaSlowPeriod());
        if (req.rsiPeriod() != null) s.setRsiPeriod(req.rsiPeriod());
        if (req.rsiOverbought() != null) s.setRsiOverbought(req.rsiOverbought());
        if (req.rsiOversold() != null) s.setRsiOversold(req.rsiOversold());
        if (req.macdFast() != null) s.setMacdFast(req.macdFast());
        if (req.macdSlow() != null) s.setMacdSlow(req.macdSlow());
        if (req.macdSignal() != null) s.setMacdSignal(req.macdSignal());
        if (req.bbPeriod() != null) s.setBbPeriod(req.bbPeriod());
        if (req.bbStdDev() != null) s.setBbStdDev(req.bbStdDev());

        if (req.useEmaCross() != null) s.setUseEmaCross(req.useEmaCross());
        if (req.useRsiFilter() != null) s.setUseRsiFilter(req.useRsiFilter());
        if (req.useMacdFilter() != null) s.setUseMacdFilter(req.useMacdFilter());
        if (req.useBbFilter() != null) s.setUseBbFilter(req.useBbFilter());

        if (req.riskPerTradePct() != null) s.setRiskPerTradePct(req.riskPerTradePct());
        if (req.leverage() != null) s.setLeverage(req.leverage());
        if (req.quantity() != null) s.setQuantity(req.quantity());
        if (req.stopLossPct() != null) s.setStopLossPct(req.stopLossPct());
        if (req.takeProfitPct() != null) s.setTakeProfitPct(req.takeProfitPct());
        if (req.maxOpenPositions() != null) s.setMaxOpenPositions(req.maxOpenPositions());
        if (req.dailyLossLimit() != null) s.setDailyLossLimit(req.dailyLossLimit());
    }

    // =========================================================================
    // MATHEMATICAL TECHNICAL ANALYSIS HELPER ALGORITHMS
    // =========================================================================

    private double[] calculateEma(double[] values, int period) {
        double[] ema = new double[values.length];
        if (values.length == 0 || period <= 0) return ema;

        double multiplier = 2.0 / (period + 1);

        // Start with SMA for first period
        double sum = 0;
        int initialCount = Math.min(period, values.length);
        for (int i = 0; i < initialCount; i++) {
            sum += values[i];
            ema[i] = sum / (i + 1);
        }

        for (int i = initialCount; i < values.length; i++) {
            ema[i] = (values[i] - ema[i - 1]) * multiplier + ema[i - 1];
        }

        return ema;
    }

    private double[] calculateRsi(double[] values, int period) {
        double[] rsi = new double[values.length];
        if (values.length <= period || period <= 0) return rsi;

        double gainSum = 0;
        double lossSum = 0;

        for (int i = 1; i <= period; i++) {
            double diff = values[i] - values[i - 1];
            if (diff >= 0) gainSum += diff;
            else lossSum += Math.abs(diff);
        }

        double avgGain = gainSum / period;
        double avgLoss = lossSum / period;

        rsi[period] = avgLoss == 0 ? 100 : (100.0 - (100.0 / (1.0 + (avgGain / avgLoss))));

        for (int i = period + 1; i < values.length; i++) {
            double diff = values[i] - values[i - 1];
            double gain = diff >= 0 ? diff : 0;
            double loss = diff < 0 ? Math.abs(diff) : 0;

            avgGain = (avgGain * (period - 1) + gain) / period;
            avgLoss = (avgLoss * (period - 1) + loss) / period;

            rsi[i] = avgLoss == 0 ? 100 : (100.0 - (100.0 / (1.0 + (avgGain / avgLoss))));
        }

        return rsi;
    }

    private double[][] calculateMacd(double[] values, int fastPeriod, int slowPeriod, int signalPeriod) {
        double[] fastEma = calculateEma(values, fastPeriod);
        double[] slowEma = calculateEma(values, slowPeriod);

        double[] macdLine = new double[values.length];
        for (int i = 0; i < values.length; i++) {
            macdLine[i] = fastEma[i] - slowEma[i];
        }

        double[] signalLine = calculateEma(macdLine, signalPeriod);
        double[] histogram = new double[values.length];
        for (int i = 0; i < values.length; i++) {
            histogram[i] = macdLine[i] - signalLine[i];
        }

        return new double[][] { macdLine, signalLine, histogram };
    }

    private double[][] calculateBollingerBands(double[] values, int period, double stdDevMultiplier) {
        double[] upper = new double[values.length];
        double[] middle = new double[values.length];
        double[] lower = new double[values.length];

        for (int i = 0; i < values.length; i++) {
            int start = Math.max(0, i - period + 1);
            int count = i - start + 1;

            double sum = 0;
            for (int j = start; j <= i; j++) {
                sum += values[j];
            }
            double mean = sum / count;
            middle[i] = mean;

            double varianceSum = 0;
            for (int j = start; j <= i; j++) {
                varianceSum += Math.pow(values[j] - mean, 2);
            }
            double stdDev = Math.sqrt(varianceSum / count);

            upper[i] = mean + (stdDev * stdDevMultiplier);
            lower[i] = mean - (stdDev * stdDevMultiplier);
        }

        return new double[][] { upper, middle, lower };
    }
}
