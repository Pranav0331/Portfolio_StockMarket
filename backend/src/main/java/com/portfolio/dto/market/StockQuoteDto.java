package com.portfolio.dto.market;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.math.BigDecimal;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record StockQuoteDto(
        String symbol,
        String name,
        BigDecimal price,
        BigDecimal change,
        String changePercent,
        BigDecimal previousClose,
        BigDecimal open,
        BigDecimal high,
        BigDecimal low,
        Long volume,
        String latestTradingDay
) {}
