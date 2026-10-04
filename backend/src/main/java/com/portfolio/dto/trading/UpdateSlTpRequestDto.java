package com.portfolio.dto.trading;

import java.math.BigDecimal;

public record UpdateSlTpRequestDto(
        BigDecimal stopLoss,
        BigDecimal takeProfit
) {}
