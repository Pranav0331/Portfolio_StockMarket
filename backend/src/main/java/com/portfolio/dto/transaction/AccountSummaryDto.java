package com.portfolio.dto.transaction;

import java.math.BigDecimal;
import java.time.Instant;

public record AccountSummaryDto(
        BigDecimal initialFundingAmount,
        boolean initialFundingRecorded,
        Instant initialFundingTime,
        BigDecimal totalDeposited,
        BigDecimal totalWithdrawn,
        BigDecimal currentCashBalance,
        BigDecimal totalRealizedPnl,
        BigDecimal totalUnrealizedPnl,
        BigDecimal overallTradingPnl,
        BigDecimal accountEquity,
        BigDecimal marginUsed,
        BigDecimal spotHoldingsMarketValue,
        int totalTradesCount,
        int openPositionsCount
) {}
