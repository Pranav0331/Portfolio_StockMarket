package com.portfolio.dto.trading;

import com.portfolio.entity.enums.PositionSide;
import com.portfolio.entity.enums.TradingMode;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

public record TradeRequestDto(
        @NotBlank(message = "Symbol is required")
        String symbol,

        @NotNull(message = "Quantity is required")
        @DecimalMin(value = "0.0001", message = "Quantity must be greater than zero")
        BigDecimal quantity,

        TradingMode tradingMode,

        PositionSide side,

        Integer leverage,

        BigDecimal stopLoss,

        BigDecimal takeProfit
) {
    public TradeRequestDto(String symbol, BigDecimal quantity) {
        this(symbol, quantity, TradingMode.INTRADAY, null, null, null, null);
    }

    public TradeRequestDto(String symbol, BigDecimal quantity, TradingMode tradingMode) {
        this(symbol, quantity, tradingMode, null, null, null, null);
    }
}
