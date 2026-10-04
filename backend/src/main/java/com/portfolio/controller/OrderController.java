package com.portfolio.controller;

import com.portfolio.dto.common.PageResponseDto;
import com.portfolio.dto.order.OrderDto;
import com.portfolio.security.UserPrincipal;
import com.portfolio.service.OrderService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;

@RestController
@RequestMapping("/api/orders")
public class OrderController {

    private static final Logger log = LoggerFactory.getLogger(OrderController.class);

    private final OrderService orderService;

    public OrderController(OrderService orderService) {
        this.orderService = orderService;
    }

    @GetMapping
    public ResponseEntity<PageResponseDto<OrderDto>> getOrders(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String tradingMode,
            @RequestParam(required = false) String symbol,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "15") int size,
            @RequestParam(defaultValue = "desc") String sort
    ) {
        if (userPrincipal == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User is not authenticated");
        }

        Instant startInstant = parseDateOrInstant(startDate, false);
        Instant endInstant = parseDateOrInstant(endDate, true);

        PageResponseDto<OrderDto> response = orderService.getUserOrders(
                userPrincipal.getId(),
                type,
                status,
                tradingMode,
                symbol,
                startInstant,
                endInstant,
                page,
                size,
                sort
        );

        return ResponseEntity.ok(response);
    }

    private Instant parseDateOrInstant(String dateStr, boolean isEndOfDay) {
        if (dateStr == null || dateStr.trim().isEmpty()) {
            return null;
        }

        String cleanStr = dateStr.trim();
        try {
            return Instant.parse(cleanStr);
        } catch (DateTimeParseException ignored) {}

        try {
            LocalDate date = LocalDate.parse(cleanStr);
            if (isEndOfDay) {
                return date.atTime(23, 59, 59, 999_000_000).toInstant(ZoneOffset.UTC);
            } else {
                return date.atStartOfDay().toInstant(ZoneOffset.UTC);
            }
        } catch (DateTimeParseException e) {
            log.warn("Invalid date format provided for orders filter: {}", cleanStr);
            return null;
        }
    }
}
