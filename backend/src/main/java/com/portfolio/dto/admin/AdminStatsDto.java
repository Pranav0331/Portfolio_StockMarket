package com.portfolio.dto.admin;

public record AdminStatsDto(
        long totalUsers,
        long activeUsers,
        long suspendedUsers,
        long inactiveUsers,
        long totalOrders,
        long totalTransactions,
        long totalHoldings,
        long totalAlerts,
        long totalWatchlistItems,
        long timestamp
) {}
