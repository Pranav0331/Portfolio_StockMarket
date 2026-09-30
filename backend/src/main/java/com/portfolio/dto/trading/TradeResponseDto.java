package com.portfolio.dto.trading;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.portfolio.entity.enums.OrderStatus;
import com.portfolio.entity.enums.OrderType;
import java.math.BigDecimal;
import java.time.Instant;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record TradeResponseDto(
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
) {}
