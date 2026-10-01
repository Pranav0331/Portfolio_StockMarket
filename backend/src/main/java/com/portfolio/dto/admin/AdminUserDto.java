package com.portfolio.dto.admin;

import java.math.BigDecimal;

public record AdminUserDto(
        Long id,
        String email,
        String fullName,
        String role,
        String status,
        String provider,
        Long createdAt,
        Long updatedAt,
        int holdingsCount,
        int ordersCount,
        int transactionsCount,
        int alertsCount,
        int watchlistCount,
        BigDecimal virtualBalance
) {}
