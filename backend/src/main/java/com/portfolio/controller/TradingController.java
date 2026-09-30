package com.portfolio.controller;

import com.portfolio.dto.market.StockQuoteDto;
import com.portfolio.dto.trading.TradeRequestDto;
import com.portfolio.dto.trading.TradeResponseDto;
import com.portfolio.dto.trading.UserHoldingDto;
import com.portfolio.dto.trading.VirtualWalletDto;
import com.portfolio.security.UserPrincipal;
import com.portfolio.service.TradingService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/trading")
public class TradingController {

    private final TradingService tradingService;

    public TradingController(TradingService tradingService) {
        this.tradingService = tradingService;
    }

    @PostMapping("/buy")
    public ResponseEntity<TradeResponseDto> buy(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Valid @RequestBody TradeRequestDto request
    ) {
        if (userPrincipal == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User must be authenticated to trade");
        }
        TradeResponseDto response = tradingService.executeBuy(userPrincipal.getId(), request);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/sell")
    public ResponseEntity<TradeResponseDto> sell(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Valid @RequestBody TradeRequestDto request
    ) {
        if (userPrincipal == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User must be authenticated to trade");
        }
        TradeResponseDto response = tradingService.executeSell(userPrincipal.getId(), request);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/wallet")
    public ResponseEntity<VirtualWalletDto> getWallet(
            @AuthenticationPrincipal UserPrincipal userPrincipal
    ) {
        if (userPrincipal == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User must be authenticated to access wallet");
        }
        VirtualWalletDto wallet = tradingService.getWallet(userPrincipal.getId());
        return ResponseEntity.ok(wallet);
    }

    @GetMapping("/holdings")
    public ResponseEntity<List<UserHoldingDto>> getHoldings(
            @AuthenticationPrincipal UserPrincipal userPrincipal
    ) {
        if (userPrincipal == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User must be authenticated to view holdings");
        }
        List<UserHoldingDto> holdings = tradingService.getUserHoldings(userPrincipal.getId());
        return ResponseEntity.ok(holdings);
    }

    @GetMapping("/holdings/{symbol}")
    public ResponseEntity<UserHoldingDto> getHoldingForSymbol(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @PathVariable String symbol
    ) {
        if (userPrincipal == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User must be authenticated to view holding");
        }
        return tradingService.getUserHoldingForSymbol(userPrincipal.getId(), symbol)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/quote")
    public ResponseEntity<StockQuoteDto> getTradablePrice(@RequestParam String symbol) {
        StockQuoteDto quote = tradingService.fetchRealMarketQuote(symbol);
        if (quote == null || quote.price() == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No tradable market data found for symbol: " + symbol);
        }
        return ResponseEntity.ok(quote);
    }
}
