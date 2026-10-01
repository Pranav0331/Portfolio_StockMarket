package com.portfolio.dto.admin;

import java.math.BigDecimal;

public record AdminTransactionDto(
        Long id,
        Long userId,
        String userEmail,
        String userName,
        String symbol,
        String companyName,
        String transactionType,
        BigDecimal quantity,
        BigDecimal pricePerUnit,
        BigDecimal totalAmount,
        BigDecimal fees,
        String status,
        Long createdAt
) {}
