package com.portfolio.dto.trading;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.portfolio.entity.enums.OrderStatus;
import com.portfolio.entity.enums.OrderType;
import com.portfolio.entity.enums.PositionSide;
import com.portfolio.entity.enums.TradingMode;
import java.math.BigDecimal;
import java.time.Instant;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record TradeResponseDto(
        Long orderId,
        Long transactionId,
        Long positionId,
        String symbol,
        String companyName,
        OrderType orderType,
        PositionSide positionSide,
        OrderStatus orderStatus,
        TradingMode tradingMode,
        BigDecimal quantity,
        BigDecimal executionPrice,
        BigDecimal totalAmount,
        Integer leverage,
        BigDecimal marginUsed,
        BigDecimal stopLoss,
        BigDecimal takeProfit,
        BigDecimal remainingCashBalance,
        BigDecimal currentHoldingQuantity,
        Instant executedAt,
        String message
) {
    public TradeResponseDto(
            Long orderId,
            Long transactionId,
            String symbol,
            String companyName,
            OrderType orderType,
            OrderStatus orderStatus,
            BigDecimal quantity,
            BigDecimal executionPrice,
            BigDecimal totalAmount,
            BigDecimal remainingCashBalance,
            BigDecimal currentHoldingQuantity,
            Instant executedAt,
            String message
    ) {
        this(orderId, transactionId, null, symbol, companyName, orderType, PositionSide.LONG, orderStatus, TradingMode.INTRADAY, quantity, executionPrice, totalAmount, 1, BigDecimal.ZERO, null, null, remainingCashBalance, currentHoldingQuantity, executedAt, message);
    }

    public TradeResponseDto(
            Long orderId,
            Long transactionId,
            String symbol,
            String companyName,
            OrderType orderType,
            OrderStatus orderStatus,
            TradingMode tradingMode,
            BigDecimal quantity,
            BigDecimal executionPrice,
            BigDecimal totalAmount,
            BigDecimal remainingCashBalance,
            BigDecimal currentHoldingQuantity,
            Instant executedAt,
            String message
    ) {
        this(orderId, transactionId, null, symbol, companyName, orderType, PositionSide.LONG, orderStatus, tradingMode, quantity, executionPrice, totalAmount, 1, BigDecimal.ZERO, null, null, remainingCashBalance, currentHoldingQuantity, executedAt, message);
    }
}
