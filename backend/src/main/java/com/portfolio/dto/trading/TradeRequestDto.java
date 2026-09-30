package com.portfolio.dto.trading;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

public record TradeRequestDto(
        @NotBlank(message = "Symbol is required")
        String symbol,

        @NotNull(message = "Quantity is required")
        @DecimalMin(value = "0.0001", message = "Quantity must be greater than zero")
        BigDecimal quantity
) {}
