package com.portfolio.dto.watchlist;

import java.math.BigDecimal;

public record WatchlistItemDto(
        Long id,
        Long stockId,
        String symbol,
        String companyName,
        String exchange,
        String currency,
        String category,
        BigDecimal currentPrice,
        BigDecimal change,
        String changePercent,
        BigDecimal previousClose,
        Long volume,
        Integer displayOrder,
        Boolean priceAvailable,
        Long lastUpdated,
        String provider,
        String notes
) {}
