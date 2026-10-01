package com.portfolio.dto.watchlist;

import java.util.List;

public record WatchlistResponseDto(
        List<WatchlistItemDto> items,
        List<String> categories,
        Integer totalCount,
        Long lastRefreshed
) {}
