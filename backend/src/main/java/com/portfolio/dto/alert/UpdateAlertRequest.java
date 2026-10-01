package com.portfolio.dto.alert;

import jakarta.validation.constraints.DecimalMin;

import java.math.BigDecimal;

public record UpdateAlertRequest(
        String condition,

        @DecimalMin(value = "0.0001", message = "Target price must be greater than 0")
        BigDecimal targetPrice,

        String status,

        String notes
) {}
