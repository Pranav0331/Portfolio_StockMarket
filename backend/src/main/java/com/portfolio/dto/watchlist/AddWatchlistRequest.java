package com.portfolio.dto.watchlist;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AddWatchlistRequest(
        @NotBlank(message = "Symbol is required")
        @Size(min = 1, max = 30, message = "Symbol must be between 1 and 30 characters")
        String symbol,

        String category,

        @Size(max = 500, message = "Notes cannot exceed 500 characters")
        String notes
) {}
