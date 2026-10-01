package com.portfolio.dto.risk;

import java.math.BigDecimal;

public record RiskExposureDto(
        BigDecimal totalInvested,
        BigDecimal equityMarketValue,
        BigDecimal cashBalance,
        BigDecimal totalPortfolioValue,
        BigDecimal equityAllocationPercent,
        BigDecimal cashAllocationPercent,
        BigDecimal var95DailyAmount,
        BigDecimal var95DailyPercent
) {}
