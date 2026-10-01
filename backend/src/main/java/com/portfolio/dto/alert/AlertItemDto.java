package com.portfolio.dto.alert;

import java.math.BigDecimal;

public record AlertItemDto(
        Long id,
        Long stockId,
        String symbol,
        String companyName,
        String exchange,
        String currency,
        BigDecimal targetPrice,
        String conditionType,
        String status,
        BigDecimal currentPrice,
        boolean priceAvailable,
        BigDecimal triggeredPrice,
        Long triggeredAt,
        Long createdAt,
        Long updatedAt,
        String provider,
        String notes,
        String message
) {}
