package com.portfolio.dto.market;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record StockSearchResponseDto(
        List<StockSearchItemDto> bestMatches,
        String query
) {}
