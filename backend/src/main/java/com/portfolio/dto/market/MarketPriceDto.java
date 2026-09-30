package com.portfolio.dto.market;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.math.BigDecimal;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record MarketPriceDto(
        String symbol,
        BigDecimal price,
        BigDecimal change,
        String changePercent,
        Long timestamp
) {}
