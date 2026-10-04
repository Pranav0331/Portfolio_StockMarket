package com.portfolio.controller;

import com.portfolio.dto.market.StockQuoteDto;
import com.portfolio.dto.trading.*;
import com.portfolio.entity.enums.PositionStatus;
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

    @GetMapping("/positions")
    public ResponseEntity<List<PositionDto>> getPositions(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @RequestParam(required = false) String symbol,
            @RequestParam(required = false) PositionStatus status
    ) {
        if (userPrincipal == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User must be authenticated to view positions");
        }
        List<PositionDto> positions = tradingService.getUserPositions(userPrincipal.getId(), symbol, status);
        return ResponseEntity.ok(positions);
    }

    @PostMapping("/positions/{id}/close")
    public ResponseEntity<PositionDto> closePosition(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @PathVariable Long id,
            @RequestBody(required = false) ClosePositionRequestDto request
    ) {
        if (userPrincipal == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User must be authenticated to close position");
        }
        java.math.BigDecimal qty = request != null ? request.quantity() : null;
        PositionDto closedPosition = tradingService.closePosition(userPrincipal.getId(), id, qty);
        return ResponseEntity.ok(closedPosition);
    }

    @PutMapping("/positions/{id}/sl-tp")
    public ResponseEntity<PositionDto> updateSlTp(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @PathVariable Long id,
            @Valid @RequestBody UpdateSlTpRequestDto request
    ) {
        if (userPrincipal == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User must be authenticated to update SL/TP");
        }
        PositionDto updated = tradingService.updatePositionSlTp(userPrincipal.getId(), id, request);
        return ResponseEntity.ok(updated);
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

    @PostMapping("/wallet/deposit")
    public ResponseEntity<VirtualWalletDto> depositCash(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Valid @RequestBody DepositRequestDto request
    ) {
        if (userPrincipal == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User must be authenticated to deposit funds");
        }
        VirtualWalletDto wallet = tradingService.depositCash(userPrincipal.getId(), request.amount());
        return ResponseEntity.ok(wallet);
    }

    @PostMapping("/wallet/reset")
    public ResponseEntity<VirtualWalletDto> resetBalance(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @RequestBody(required = false) ResetBalanceRequestDto request
    ) {
        if (userPrincipal == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User must be authenticated to reset balance");
        }
        java.math.BigDecimal target = request != null ? request.targetBalance() : null;
        VirtualWalletDto wallet = tradingService.resetCashBalance(userPrincipal.getId(), target);
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
