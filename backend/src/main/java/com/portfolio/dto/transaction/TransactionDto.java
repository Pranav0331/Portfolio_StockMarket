package com.portfolio.dto.transaction;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.math.BigDecimal;
import java.time.Instant;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record TransactionDto(
        Long transactionId,
        Long orderId,
        Long positionId,
        String symbol,
        String companyName,
        String exchange,
        String currency,
        String type,
        String status,
        String tradingMode,
        String positionSide,
        Integer leverage,
        BigDecimal marginUsed,
        BigDecimal quantity,
        BigDecimal executionPrice,
        BigDecimal totalAmount,
        BigDecimal fees,
        Instant executedAt,
        BigDecimal pnl,
        BigDecimal pnlPercent,
        BigDecimal avgBuyPrice,
        BigDecimal currentPrice
) {
    public TransactionDto(
            Long transactionId,
            Long orderId,
            String symbol,
            String companyName,
            String exchange,
            String currency,
            String type,
            String status,
            BigDecimal quantity,
            BigDecimal executionPrice,
            BigDecimal totalAmount,
            BigDecimal fees,
            Instant executedAt
    ) {
        this(transactionId, orderId, null, symbol, companyName, exchange, currency, type, status, "INTRADAY", null, 1, BigDecimal.ZERO, quantity, executionPrice, totalAmount, fees, executedAt, BigDecimal.ZERO, BigDecimal.ZERO, executionPrice, executionPrice);
    }

    public TransactionDto(
            Long transactionId,
            Long orderId,
            String symbol,
            String companyName,
            String exchange,
            String currency,
            String type,
            String status,
            BigDecimal quantity,
            BigDecimal executionPrice,
            BigDecimal totalAmount,
            BigDecimal fees,
            Instant executedAt,
            BigDecimal pnl,
            BigDecimal pnlPercent,
            BigDecimal avgBuyPrice,
            BigDecimal currentPrice
    ) {
        this(transactionId, orderId, null, symbol, companyName, exchange, currency, type, status, "INTRADAY", null, 1, BigDecimal.ZERO, quantity, executionPrice, totalAmount, fees, executedAt, pnl, pnlPercent, avgBuyPrice, currentPrice);
    }

    public TransactionDto(
            Long transactionId,
            Long orderId,
            String symbol,
            String companyName,
            String exchange,
            String currency,
            String type,
            String status,
            String tradingMode,
            BigDecimal quantity,
            BigDecimal executionPrice,
            BigDecimal totalAmount,
            BigDecimal fees,
            Instant executedAt,
            BigDecimal pnl,
            BigDecimal pnlPercent,
            BigDecimal avgBuyPrice,
            BigDecimal currentPrice
    ) {
        this(transactionId, orderId, null, symbol, companyName, exchange, currency, type, status, tradingMode != null ? tradingMode : "INTRADAY", null, 1, BigDecimal.ZERO, quantity, executionPrice, totalAmount, fees, executedAt, pnl, pnlPercent, avgBuyPrice, currentPrice);
    }
}
