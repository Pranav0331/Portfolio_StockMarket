package com.portfolio.dto.trading;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.math.BigDecimal;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record VirtualWalletDto(
        BigDecimal cashBalance,
        BigDecimal totalInvested,
        BigDecimal totalPortfolioValue,
        String currency,
        BigDecimal marginUsed,
        BigDecimal floatingPnl,
        BigDecimal freeMargin,
        BigDecimal marginLevelPercent
) {
    public VirtualWalletDto(BigDecimal cashBalance, BigDecimal totalInvested, BigDecimal totalPortfolioValue, String currency) {
        this(cashBalance, totalInvested, totalPortfolioValue, currency, BigDecimal.ZERO, BigDecimal.ZERO, cashBalance, BigDecimal.ZERO);
    }
}
