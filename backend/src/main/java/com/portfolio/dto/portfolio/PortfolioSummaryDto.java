package com.portfolio.dto.portfolio;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.portfolio.dto.trading.UserHoldingDto;
import java.math.BigDecimal;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record PortfolioSummaryDto(
        BigDecimal cashBalance,
        BigDecimal totalInvested,
        BigDecimal totalHoldingsMarketValue,
        BigDecimal totalPortfolioValue,
        BigDecimal totalUnrealizedPnL,
        BigDecimal totalUnrealizedPnLPercent,
        int totalHoldingsCount,
        BigDecimal cashAllocationPercent,
        List<UserHoldingDto> holdings,
        BigDecimal todayPnL,
        BigDecimal todayPnLPercent
) {
    public PortfolioSummaryDto(
            BigDecimal cashBalance,
            BigDecimal totalInvested,
            BigDecimal totalHoldingsMarketValue,
            BigDecimal totalPortfolioValue,
            BigDecimal totalUnrealizedPnL,
            BigDecimal totalUnrealizedPnLPercent,
            int totalHoldingsCount,
            BigDecimal cashAllocationPercent,
            List<UserHoldingDto> holdings
    ) {
        this(cashBalance, totalInvested, totalHoldingsMarketValue, totalPortfolioValue, totalUnrealizedPnL, totalUnrealizedPnLPercent, totalHoldingsCount, cashAllocationPercent, holdings, BigDecimal.ZERO, BigDecimal.ZERO);
    }
}
