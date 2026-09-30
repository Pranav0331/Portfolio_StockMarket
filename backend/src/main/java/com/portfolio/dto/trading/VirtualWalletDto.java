package com.portfolio.dto.trading;

import java.math.BigDecimal;

public record VirtualWalletDto(
        BigDecimal cashBalance,
        BigDecimal totalInvested,
        BigDecimal totalPortfolioValue,
        String currency
) {}
