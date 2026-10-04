package com.portfolio.dto.order;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.math.BigDecimal;
import java.time.Instant;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record OrderDto(
        Long id,
        String symbol,
        String companyName,
        String exchange,
        String currency,
        String orderType,
        String orderStatus,
        String tradingMode,
        String positionSide,
        Integer leverage,
        BigDecimal marginUsed,
        BigDecimal stopLoss,
        BigDecimal takeProfit,
        Long positionId,
        BigDecimal realizedPnl,
        BigDecimal quantity,
        BigDecimal price,
        BigDecimal executedPrice,
        BigDecimal totalAmount,
        Instant executedAt,
        Instant createdAt
) {
    public OrderDto(
            Long id,
            String symbol,
            String companyName,
            String exchange,
            String currency,
            String orderType,
            String orderStatus,
            BigDecimal quantity,
            BigDecimal price,
            BigDecimal executedPrice,
            BigDecimal totalAmount,
            Instant executedAt,
            Instant createdAt
    ) {
        this(id, symbol, companyName, exchange, currency, orderType, orderStatus, "INTRADAY", "LONG", 1, BigDecimal.ZERO, null, null, null, null, quantity, price, executedPrice, totalAmount, executedAt, createdAt);
    }

    public OrderDto(
            Long id,
            String symbol,
            String companyName,
            String exchange,
            String currency,
            String orderType,
            String orderStatus,
            String tradingMode,
            BigDecimal quantity,
            BigDecimal price,
            BigDecimal executedPrice,
            BigDecimal totalAmount,
            Instant executedAt,
            Instant createdAt
    ) {
        this(id, symbol, companyName, exchange, currency, orderType, orderStatus, tradingMode != null ? tradingMode : "INTRADAY", "LONG", 1, BigDecimal.ZERO, null, null, null, null, quantity, price, executedPrice, totalAmount, executedAt, createdAt);
    }
}
