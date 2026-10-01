package com.portfolio.dto.admin;

import java.util.List;

public record AdminDashboardSummaryDto(
        AdminStatsDto stats,
        List<AdminUserDto> recentUsers,
        List<AdminOrderDto> recentOrders,
        List<AdminTransactionDto> recentTransactions
) {}
