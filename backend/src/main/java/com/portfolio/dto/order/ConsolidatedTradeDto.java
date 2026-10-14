package com.portfolio.dto.order;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.math.BigDecimal;
import java.time.Instant;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record ConsolidatedTradeDto(
        Long tradeId,
        Long entryOrderId,
        Long exitOrderId,
        String symbol,
        String companyName,
        String exchange,
        String currency,
        String direction,
        String tradingMode,
        Integer leverage,
        BigDecimal quantity,
        BigDecimal entryPrice,
        BigDecimal exitPrice,
        BigDecimal currentPrice,
        BigDecimal realizedPnl,
        BigDecimal unrealizedPnl,
        BigDecimal unrealizedPnlPercent,
        BigDecimal marginUsed,
        String status,
        Instant openTime,
        Instant closeTime
) {}
