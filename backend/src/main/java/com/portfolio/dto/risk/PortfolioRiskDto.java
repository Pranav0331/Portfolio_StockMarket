package com.portfolio.dto.risk;

import java.math.BigDecimal;
import java.util.List;

public record PortfolioRiskDto(
        RiskExposureDto exposure,
        BigDecimal annualizedVolatilityPercent,
        BigDecimal maxDrawdownPercent,
        BigDecimal herfindahlHirschmanIndex,
        BigDecimal top1HoldingWeightPercent,
        BigDecimal top3HoldingWeightPercent,
        BigDecimal effectiveNumberOfAssets,
        String diversificationRating,
        BigDecimal portfolioBeta,
        String benchmarkSymbol,
        Boolean benchmarkAvailable,
        List<HoldingRiskDto> holdings,
        List<HistoricalRiskPointDto> historicalRiskSeries,
        Long calculationTimestamp,
        String dataSource,
        Boolean emptyPortfolio,
        Boolean dataAvailable,
        String statusMessage
) {}
