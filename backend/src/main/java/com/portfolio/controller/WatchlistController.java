package com.portfolio.controller;

import com.portfolio.dto.watchlist.AddWatchlistRequest;
import com.portfolio.dto.watchlist.ReorderWatchlistRequest;
import com.portfolio.dto.watchlist.WatchlistItemDto;
import com.portfolio.dto.watchlist.WatchlistResponseDto;
import com.portfolio.security.UserPrincipal;
import com.portfolio.service.WatchlistService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

@RestController
@RequestMapping("/api/watchlist")
public class WatchlistController {

    private final WatchlistService watchlistService;

    public WatchlistController(WatchlistService watchlistService) {
        this.watchlistService = watchlistService;
    }

    @GetMapping
    public ResponseEntity<WatchlistResponseDto> getWatchlist(
            @AuthenticationPrincipal UserPrincipal userPrincipal
    ) {
        if (userPrincipal == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User must be authenticated to view watchlist");
        }
        WatchlistResponseDto response = watchlistService.getUserWatchlist(userPrincipal.getId());
        return ResponseEntity.ok(response);
    }

    @PostMapping
    public ResponseEntity<WatchlistItemDto> addToWatchlist(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Valid @RequestBody AddWatchlistRequest request
    ) {
        if (userPrincipal == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User must be authenticated to add to watchlist");
        }
        WatchlistItemDto item = watchlistService.addToWatchlist(userPrincipal.getId(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(item);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, String>> removeFromWatchlist(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @PathVariable Long id
    ) {
        if (userPrincipal == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User must be authenticated to remove from watchlist");
        }
        watchlistService.removeFromWatchlist(userPrincipal.getId(), id);
        return ResponseEntity.ok(Map.of("message", "Item successfully removed from watchlist"));
    }

    @DeleteMapping("/symbol/{symbol}")
    public ResponseEntity<Map<String, String>> removeFromWatchlistBySymbol(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @PathVariable String symbol
    ) {
        if (userPrincipal == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User must be authenticated to remove from watchlist");
        }
        watchlistService.removeFromWatchlistBySymbol(userPrincipal.getId(), symbol);
        return ResponseEntity.ok(Map.of("message", "Symbol successfully removed from watchlist"));
    }

    @PutMapping("/reorder")
    public ResponseEntity<Map<String, String>> reorderWatchlist(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Valid @RequestBody ReorderWatchlistRequest request
    ) {
        if (userPrincipal == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User must be authenticated to reorder watchlist");
        }
        watchlistService.reorderWatchlist(userPrincipal.getId(), request);
        return ResponseEntity.ok(Map.of("message", "Watchlist order updated successfully"));
    }

    @GetMapping("/check/{symbol}")
    public ResponseEntity<Map<String, Boolean>> checkInWatchlist(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @PathVariable String symbol
    ) {
        if (userPrincipal == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User must be authenticated to check watchlist");
        }
        boolean inWatchlist = watchlistService.isInWatchlist(userPrincipal.getId(), symbol);
        return ResponseEntity.ok(Map.of("inWatchlist", inWatchlist));
    }
}
