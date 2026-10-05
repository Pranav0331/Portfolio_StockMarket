package com.portfolio.dto.algo;

import com.portfolio.entity.enums.MarketType;
import com.portfolio.entity.enums.StrategyDirection;
import com.portfolio.entity.enums.TradingMode;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

public record AlgoStrategyRequestDto(
        @NotBlank(message = "Strategy name is required")
        String name,

        @NotBlank(message = "Symbol is required")
        String symbol,

        MarketType market,
        TradingMode tradingMode,
        String timeframe,
        StrategyDirection direction,

        // Indicator settings
        Integer emaFastPeriod,
        Integer emaSlowPeriod,
        Integer rsiPeriod,
        BigDecimal rsiOverbought,
        BigDecimal rsiOversold,
        Integer macdFast,
        Integer macdSlow,
        Integer macdSignal,
        Integer bbPeriod,
        BigDecimal bbStdDev,

        Boolean useEmaCross,
        Boolean useRsiFilter,
        Boolean useMacdFilter,
        Boolean useBbFilter,

        // Risk settings
        BigDecimal riskPerTradePct,
        Integer leverage,

        @NotNull(message = "Quantity is required")
        @DecimalMin(value = "0.0001", message = "Quantity must be at least 0.0001")
        BigDecimal quantity,

        BigDecimal stopLossPct,
        BigDecimal takeProfitPct,
        Integer maxOpenPositions,
        BigDecimal dailyLossLimit
) {}
