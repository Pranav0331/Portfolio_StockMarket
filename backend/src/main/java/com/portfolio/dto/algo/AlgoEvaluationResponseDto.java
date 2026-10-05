package com.portfolio.dto.algo;

import com.portfolio.entity.enums.AlgoSignal;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public record AlgoEvaluationResponseDto(
        Long strategyId,
        String symbol,
        BigDecimal currentPrice,
        String trend, // "BULLISH", "BEARISH", "NEUTRAL"
        AlgoSignal signal, // BUY, SELL, WAIT
        BigDecimal confidence, // 0 - 100
        List<String> reasons,
        List<String> activeIndicators,
        String riskLevel, // "LOW", "MODERATE", "HIGH"
        boolean tradeExecuted,
        String executionMessage,
        Long orderId,
        Long positionId,
        BigDecimal requiredMargin,
        BigDecimal positionSize,
        BigDecimal maxRiskAmount,
        LocalDateTime evaluatedAt
) {}
