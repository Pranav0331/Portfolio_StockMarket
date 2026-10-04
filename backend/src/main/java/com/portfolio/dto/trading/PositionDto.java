package com.portfolio.dto.trading;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.portfolio.entity.enums.PositionSide;
import com.portfolio.entity.enums.PositionStatus;
import com.portfolio.entity.enums.TradingMode;
import java.math.BigDecimal;
import java.time.Instant;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record PositionDto(
        Long id,
        String symbol,
        String companyName,
        String exchange,
        String currency,
        PositionSide side,
        TradingMode tradingMode,
        BigDecimal quantity,
        BigDecimal entryPrice,
        BigDecimal currentPrice,
        Integer leverage,
        BigDecimal marginUsed,
        BigDecimal positionValue,
        BigDecimal unrealizedPnl,
        BigDecimal unrealizedPnlPercent,
        BigDecimal stopLoss,
        BigDecimal takeProfit,
        PositionStatus status,
        BigDecimal closePrice,
        Instant closeTime,
        BigDecimal realizedPnl,
        Instant createdAt
) {}
