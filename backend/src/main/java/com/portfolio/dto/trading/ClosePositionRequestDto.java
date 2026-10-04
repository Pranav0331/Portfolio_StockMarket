package com.portfolio.dto.trading;

import java.math.BigDecimal;

public record ClosePositionRequestDto(
        BigDecimal quantity // null means close full position
) {}
