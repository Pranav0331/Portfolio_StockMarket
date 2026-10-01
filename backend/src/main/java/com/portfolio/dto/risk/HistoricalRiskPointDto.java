package com.portfolio.dto.risk;

import java.math.BigDecimal;

public record HistoricalRiskPointDto(
        Long timestamp,
        String date,
        BigDecimal portfolioValueIndex,
        BigDecimal drawdownPercent,
        BigDecimal rollingVolatilityPercent
) {}
