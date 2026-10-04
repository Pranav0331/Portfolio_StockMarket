package com.portfolio.dto.trading;

import java.math.BigDecimal;

public record ResetBalanceRequestDto(
        BigDecimal targetBalance
) {}
