package com.portfolio.dto.trading;

import java.math.BigDecimal;

public record UserHoldingDto(
        Long holdingId,
        String symbol,
        String companyName,
        String exchange,
        String currency,
        BigDecimal quantity,
        BigDecimal averageBuyPrice,
        BigDecimal totalInvested,
        BigDecimal currentPrice,
        BigDecimal currentValue,
        BigDecimal unrealizedPnL,
        BigDecimal unrealizedPnLPercent
) {}
