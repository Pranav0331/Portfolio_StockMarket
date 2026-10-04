package com.portfolio.dto.market;

import java.math.BigDecimal;

public record MarketTickDto(
        String type,
        String symbol,
        String instrumentKey,
        BigDecimal price,
        BigDecimal open,
        BigDecimal high,
        BigDecimal low,
        BigDecimal close,
        Long volume,
        BigDecimal change,
        String changePercent,
        Long timestamp,
        String provider,
        Boolean streamingSupported,
        String status,
        String message
) {
    public static MarketTickDto tick(
            String symbol,
            String instrumentKey,
            BigDecimal price,
            BigDecimal open,
            BigDecimal high,
            BigDecimal low,
            BigDecimal close,
            Long volume,
            BigDecimal change,
            String changePercent,
            Long timestamp
    ) {
        return new MarketTickDto(
                "TICK",
                symbol,
                instrumentKey,
                price,
                open,
                high,
                low,
                close,
                volume,
                change,
                changePercent,
                timestamp != null ? timestamp : System.currentTimeMillis(),
                null,
                true,
                "OK",
                null
        );
    }

    public static MarketTickDto tick(
            String symbol,
            String instrumentKey,
            BigDecimal price,
            BigDecimal open,
            BigDecimal high,
            BigDecimal low,
            BigDecimal close,
            Long volume,
            BigDecimal change,
            String changePercent,
            Long timestamp,
            String provider
    ) {
        return new MarketTickDto(
                "TICK",
                symbol,
                instrumentKey,
                price,
                open,
                high,
                low,
                close,
                volume,
                change,
                changePercent,
                timestamp != null ? timestamp : System.currentTimeMillis(),
                provider,
                true,
                "OK",
                null
        );
    }

    public static MarketTickDto status(String status, String message, boolean connected, String provider) {
        return new MarketTickDto(
                "STATUS",
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                System.currentTimeMillis(),
                provider,
                connected,
                status,
                message
        );
    }

    public static MarketTickDto status(String status, String message, boolean connected, String provider, String symbol) {
        return new MarketTickDto(
                "STATUS",
                symbol,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                System.currentTimeMillis(),
                provider,
                connected,
                status,
                message
        );
    }
}
