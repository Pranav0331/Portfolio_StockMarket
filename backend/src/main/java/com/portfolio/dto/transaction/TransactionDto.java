package com.portfolio.dto.transaction;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.math.BigDecimal;
import java.time.Instant;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record TransactionDto(
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
) {}
