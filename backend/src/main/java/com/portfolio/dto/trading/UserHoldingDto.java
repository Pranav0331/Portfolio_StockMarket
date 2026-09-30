package com.portfolio.dto.trading;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.math.BigDecimal;

@JsonInclude(JsonInclude.Include.NON_NULL)
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
        BigDecimal unrealizedPnLPercent,
        BigDecimal allocationPercent,
        Boolean priceAvailable
) {}
