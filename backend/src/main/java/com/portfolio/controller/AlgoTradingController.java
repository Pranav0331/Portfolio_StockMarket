package com.portfolio.controller;

import com.portfolio.dto.algo.*;
import com.portfolio.security.UserPrincipal;
import com.portfolio.service.AlgoTradingService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/algo")
public class AlgoTradingController {

    private final AlgoTradingService algoTradingService;

    public AlgoTradingController(AlgoTradingService algoTradingService) {
        this.algoTradingService = algoTradingService;
    }

    @PostMapping("/strategies")
    public ResponseEntity<AlgoStrategyResponseDto> createStrategy(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Valid @RequestBody AlgoStrategyRequestDto request
    ) {
        if (userPrincipal == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User must be authenticated");
        }
        AlgoStrategyResponseDto response = algoTradingService.createStrategy(userPrincipal.getId(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/strategies")
    public ResponseEntity<List<AlgoStrategyResponseDto>> getStrategies(
            @AuthenticationPrincipal UserPrincipal userPrincipal
    ) {
        if (userPrincipal == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User must be authenticated");
        }
        return ResponseEntity.ok(algoTradingService.getUserStrategies(userPrincipal.getId()));
    }

    @GetMapping("/strategies/{id}")
    public ResponseEntity<AlgoStrategyResponseDto> getStrategy(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @PathVariable Long id
    ) {
        if (userPrincipal == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User must be authenticated");
        }
        return ResponseEntity.ok(algoTradingService.getStrategy(userPrincipal.getId(), id));
    }

    @PutMapping("/strategies/{id}")
    public ResponseEntity<AlgoStrategyResponseDto> updateStrategy(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @PathVariable Long id,
            @Valid @RequestBody AlgoStrategyRequestDto request
    ) {
        if (userPrincipal == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User must be authenticated");
        }
        return ResponseEntity.ok(algoTradingService.updateStrategy(userPrincipal.getId(), id, request));
    }

    @DeleteMapping("/strategies/{id}")
    public ResponseEntity<Void> deleteStrategy(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @PathVariable Long id
    ) {
        if (userPrincipal == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User must be authenticated");
        }
        algoTradingService.deleteStrategy(userPrincipal.getId(), id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/strategies/{id}/start")
    public ResponseEntity<AlgoStrategyResponseDto> startStrategy(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @PathVariable Long id
    ) {
        if (userPrincipal == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User must be authenticated");
        }
        return ResponseEntity.ok(algoTradingService.startStrategy(userPrincipal.getId(), id));
    }

    @PostMapping("/strategies/{id}/pause")
    public ResponseEntity<AlgoStrategyResponseDto> pauseStrategy(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @PathVariable Long id
    ) {
        if (userPrincipal == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User must be authenticated");
        }
        return ResponseEntity.ok(algoTradingService.pauseStrategy(userPrincipal.getId(), id));
    }

    @PostMapping("/strategies/{id}/stop")
    public ResponseEntity<AlgoStrategyResponseDto> stopStrategy(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @PathVariable Long id
    ) {
        if (userPrincipal == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User must be authenticated");
        }
        return ResponseEntity.ok(algoTradingService.stopStrategy(userPrincipal.getId(), id));
    }

    @GetMapping("/strategies/{id}/status")
    public ResponseEntity<Map<String, Object>> getStrategyStatus(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @PathVariable Long id
    ) {
        if (userPrincipal == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User must be authenticated");
        }
        AlgoStrategyResponseDto strategy = algoTradingService.getStrategy(userPrincipal.getId(), id);
        return ResponseEntity.ok(Map.of(
                "strategyId", strategy.id(),
                "status", strategy.status(),
                "lastRunAt", strategy.lastRunAt() != null ? strategy.lastRunAt().toString() : "",
                "lastSignal", strategy.lastSignal() != null ? strategy.lastSignal() : "",
                "totalTrades", strategy.totalTrades(),
                "totalPnl", strategy.totalPnl()
        ));
    }

    @GetMapping("/strategies/{id}/performance")
    public ResponseEntity<AlgoPerformanceDto> getStrategyPerformance(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @PathVariable Long id
    ) {
        if (userPrincipal == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User must be authenticated");
        }
        return ResponseEntity.ok(algoTradingService.getStrategyPerformance(userPrincipal.getId(), id));
    }

    @GetMapping("/strategies/{id}/trades")
    public ResponseEntity<List<AlgoTradeLogDto>> getStrategyTrades(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @PathVariable Long id
    ) {
        if (userPrincipal == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User must be authenticated");
        }
        return ResponseEntity.ok(algoTradingService.getStrategyTrades(userPrincipal.getId(), id));
    }

    @GetMapping("/trades")
    public ResponseEntity<List<AlgoTradeLogDto>> getAllTrades(
            @AuthenticationPrincipal UserPrincipal userPrincipal
    ) {
        if (userPrincipal == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User must be authenticated");
        }
        return ResponseEntity.ok(algoTradingService.getUserTrades(userPrincipal.getId()));
    }

    @RequestMapping(value = "/strategies/{id}/evaluate", method = {RequestMethod.GET, RequestMethod.POST})
    public ResponseEntity<AlgoEvaluationResponseDto> evaluateStrategy(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @PathVariable Long id,
            @RequestParam(required = false, defaultValue = "false") boolean execute
    ) {
        if (userPrincipal == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User must be authenticated");
        }
        return ResponseEntity.ok(algoTradingService.evaluateStrategy(userPrincipal.getId(), id, execute));
    }

    @GetMapping("/evaluate")
    public ResponseEntity<AlgoEvaluationResponseDto> evaluateAdHocGet(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @RequestParam String symbol,
            @RequestParam(defaultValue = "15m") String timeframe
    ) {
        if (userPrincipal == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User must be authenticated");
        }
        com.portfolio.entity.enums.MarketType mType = symbol.contains("RELIANCE") || symbol.contains("TCS") ?
                com.portfolio.entity.enums.MarketType.INDIAN : com.portfolio.entity.enums.MarketType.CRYPTO;

        AlgoStrategyRequestDto request = new AlgoStrategyRequestDto(
                "Market AI Analysis",
                symbol,
                mType,
                com.portfolio.entity.enums.TradingMode.INTRADAY,
                timeframe,
                com.portfolio.entity.enums.StrategyDirection.BOTH,
                9, 21, 14,
                new java.math.BigDecimal("55.00"),
                new java.math.BigDecimal("45.00"),
                12, 26, 9, 20,
                new java.math.BigDecimal("2.00"),
                true, true, true, false,
                new java.math.BigDecimal("1.00"),
                10,
                new java.math.BigDecimal("0.1000"),
                new java.math.BigDecimal("1.50"),
                new java.math.BigDecimal("3.00"),
                3,
                new java.math.BigDecimal("500.00")
        );
        return ResponseEntity.ok(algoTradingService.evaluateAdHoc(userPrincipal.getId(), request));
    }

    @PostMapping("/evaluate")
    public ResponseEntity<AlgoEvaluationResponseDto> evaluateAdHoc(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Valid @RequestBody AlgoStrategyRequestDto request
    ) {
        if (userPrincipal == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User must be authenticated");
        }
        return ResponseEntity.ok(algoTradingService.evaluateAdHoc(userPrincipal.getId(), request));
    }
}
