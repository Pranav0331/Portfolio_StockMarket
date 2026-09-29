package com.portfolio.dto.market;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record StockSearchItemDto(
        String symbol,
        String name,
        String type,
        String region,
        String currency,
        String matchScore
) {}
