package com.portfolio.dto.algo;

import com.portfolio.entity.AlgoStrategy;
import com.portfolio.entity.enums.MarketType;
import com.portfolio.entity.enums.StrategyDirection;
import com.portfolio.entity.enums.StrategyStatus;
import com.portfolio.entity.enums.TradingMode;
import java.math.BigDecimal;
import java.time.LocalDateTime;

public record AlgoStrategyResponseDto(
        Long id,
        Long userId,
        String name,
        String symbol,
        MarketType market,
        TradingMode tradingMode,
        String timeframe,
        StrategyDirection direction,
        StrategyStatus status,

        int emaFastPeriod,
        int emaSlowPeriod,
        int rsiPeriod,
        BigDecimal rsiOverbought,
        BigDecimal rsiOversold,
        int macdFast,
        int macdSlow,
        int macdSignal,
        int bbPeriod,
        BigDecimal bbStdDev,

        boolean useEmaCross,
        boolean useRsiFilter,
        boolean useMacdFilter,
        boolean useBbFilter,

        BigDecimal riskPerTradePct,
        int leverage,
        BigDecimal quantity,
        BigDecimal stopLossPct,
        BigDecimal takeProfitPct,
        int maxOpenPositions,
        BigDecimal dailyLossLimit,

        int totalTrades,
        int winningTrades,
        int losingTrades,
        BigDecimal totalPnl,
        BigDecimal maxDrawdown,
        LocalDateTime lastRunAt,
        String lastSignal,
        String lastSignalReasons,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
    public static AlgoStrategyResponseDto fromEntity(AlgoStrategy strategy) {
        return new AlgoStrategyResponseDto(
                strategy.getId(),
                strategy.getUser() != null ? strategy.getUser().getId() : null,
                strategy.getName(),
                strategy.getSymbol(),
                strategy.getMarket(),
                strategy.getTradingMode(),
                strategy.getTimeframe(),
                strategy.getDirection(),
                strategy.getStatus(),
                strategy.getEmaFastPeriod(),
                strategy.getEmaSlowPeriod(),
                strategy.getRsiPeriod(),
                strategy.getRsiOverbought(),
                strategy.getRsiOversold(),
                strategy.getMacdFast(),
                strategy.getMacdSlow(),
                strategy.getMacdSignal(),
                strategy.getBbPeriod(),
                strategy.getBbStdDev(),
                strategy.isUseEmaCross(),
                strategy.isUseRsiFilter(),
                strategy.isUseMacdFilter(),
                strategy.isUseBbFilter(),
                strategy.getRiskPerTradePct(),
                strategy.getLeverage(),
                strategy.getQuantity(),
                strategy.getStopLossPct(),
                strategy.getTakeProfitPct(),
                strategy.getMaxOpenPositions(),
                strategy.getDailyLossLimit(),
                strategy.getTotalTrades(),
                strategy.getWinningTrades(),
                strategy.getLosingTrades(),
                strategy.getTotalPnl(),
                strategy.getMaxDrawdown(),
                strategy.getLastRunAt(),
                strategy.getLastSignal(),
                strategy.getLastSignalReasons(),
                strategy.getCreatedAt(),
                strategy.getUpdatedAt()
        );
    }
}
