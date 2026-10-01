package com.portfolio.dto.admin;

import java.math.BigDecimal;

public record AdminOrderDto(
        Long id,
        Long userId,
        String userEmail,
        String userName,
        String symbol,
        String companyName,
        String orderType,
        BigDecimal quantity,
        BigDecimal pricePerUnit,
        BigDecimal totalAmount,
        String status,
        Long createdAt
) {}
