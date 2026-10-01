package com.portfolio.dto.market;

import java.math.BigDecimal;

public record FundamentalDataDto(
        String symbol,
        String companyName,
        String exchange,
        String currency,
        String provider,
        String sector,
        String industry,
        String description,
        String ceo,
        String website,
        BigDecimal marketCap,
        BigDecimal peRatio,
        BigDecimal eps,
        BigDecimal roe,
        BigDecimal revenue,
        BigDecimal netIncome,
        BigDecimal dividendYield,
        BigDecimal fiftyTwoWeekHigh,
        BigDecimal fiftyTwoWeekLow,
        Long lastUpdated
) {}
