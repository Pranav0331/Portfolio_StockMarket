package com.portfolio.dto.algo;

import java.math.BigDecimal;

public record AlgoPerformanceDto(
        Long strategyId,
        int totalTrades,
        int winningTrades,
        int losingTrades,
        BigDecimal winRate,
        BigDecimal totalPnl,
        BigDecimal averageProfit,
        BigDecimal averageLoss,
        BigDecimal profitFactor,
        BigDecimal maxDrawdown
) {}
