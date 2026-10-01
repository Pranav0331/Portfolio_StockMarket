package com.portfolio.dto.watchlist;

import jakarta.validation.constraints.NotEmpty;

import java.util.List;

public record ReorderWatchlistRequest(
        @NotEmpty(message = "Ordered IDs list cannot be empty")
        List<Long> orderedIds
) {}
