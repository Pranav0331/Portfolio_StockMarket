package com.portfolio.dto.alert;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record CreateAlertRequest(
        @NotBlank(message = "Symbol is required")
        String symbol,

        @NotBlank(message = "Condition is required (ABOVE or BELOW)")
        String condition,

        @NotNull(message = "Target price is required")
        @DecimalMin(value = "0.0001", message = "Target price must be greater than 0")
        BigDecimal targetPrice,

        String notes
) {}
