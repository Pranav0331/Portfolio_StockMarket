package com.portfolio.dto.risk;

import java.math.BigDecimal;

public record HoldingRiskDto(
        Long holdingId,
        String symbol,
        String companyName,
        String exchange,
        String currency,
        BigDecimal quantity,
        BigDecimal currentPrice,
        BigDecimal currentValue,
        BigDecimal weightPercent,
        BigDecimal annualizedVolatilityPercent,
        BigDecimal maxDrawdownPercent,
        BigDecimal var95Daily,
        BigDecimal unrealizedPnL,
        BigDecimal unrealizedPnLPercent,
        String riskRating,
        Boolean dataAvailable
) {}
