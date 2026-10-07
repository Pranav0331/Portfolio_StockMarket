package com.portfolio.dto.algo;

import com.fasterxml.jackson.annotation.JsonAlias;
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

        @JsonAlias({"marketType", "market"})
        MarketType market,

        TradingMode tradingMode,
        String timeframe,
        StrategyDirection direction,

        // Indicator settings
        @JsonAlias({"ema9Period", "emaFastPeriod"})
        Integer emaFastPeriod,

        @JsonAlias({"ema21Period", "emaSlowPeriod"})
        Integer emaSlowPeriod,

        Integer rsiPeriod,

        @JsonAlias({"rsiLongThreshold", "rsiOverbought"})
        BigDecimal rsiOverbought,

        @JsonAlias({"rsiShortThreshold", "rsiOversold"})
        BigDecimal rsiOversold,

        Integer macdFast,
        Integer macdSlow,
        Integer macdSignal,

        @JsonAlias({"bollingerPeriod", "bbPeriod"})
        Integer bbPeriod,

        @JsonAlias({"bollingerStdDev", "bbStdDev"})
        BigDecimal bbStdDev,

        @JsonAlias({"condEmaCross", "useEmaCross", "useEma9"})
        Boolean useEmaCross,

        @JsonAlias({"condRsiThreshold", "useRsiFilter", "useRsi"})
        Boolean useRsiFilter,

        @JsonAlias({"condMacdDirection", "useMacdFilter", "useMacd"})
        Boolean useMacdFilter,

        @JsonAlias({"condBollingerBounce", "useBbFilter", "useBollinger"})
        Boolean useBbFilter,

        // Risk settings
        @JsonAlias({"riskPerTradePercent", "riskPerTradePct"})
        BigDecimal riskPerTradePct,

        Integer leverage,

        @NotNull(message = "Quantity is required")
        @DecimalMin(value = "0.0001", message = "Quantity must be at least 0.0001")
        BigDecimal quantity,

        @JsonAlias({"stopLossPercent", "stopLossPct"})
        BigDecimal stopLossPct,

        @JsonAlias({"takeProfitPercent", "takeProfitPct"})
        BigDecimal takeProfitPct,

        Integer maxOpenPositions,
        BigDecimal dailyLossLimit
) {}
