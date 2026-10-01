package com.portfolio.controller;

import com.portfolio.dto.alert.AlertItemDto;
import com.portfolio.dto.alert.AlertsResponseDto;
import com.portfolio.dto.alert.CreateAlertRequest;
import com.portfolio.dto.alert.UpdateAlertRequest;
import com.portfolio.security.UserPrincipal;
import com.portfolio.service.AlertService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

@RestController
@RequestMapping("/api/alerts")
public class AlertController {

    private final AlertService alertService;

    public AlertController(AlertService alertService) {
        this.alertService = alertService;
    }

    @GetMapping
    public ResponseEntity<AlertsResponseDto> getAlerts(
            @AuthenticationPrincipal UserPrincipal userPrincipal
    ) {
        if (userPrincipal == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User must be authenticated to view alerts");
        }
        AlertsResponseDto response = alertService.getUserAlerts(userPrincipal.getId());
        return ResponseEntity.ok(response);
    }

    @PostMapping
    public ResponseEntity<AlertItemDto> createAlert(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @Valid @RequestBody CreateAlertRequest request
    ) {
        if (userPrincipal == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User must be authenticated to create alerts");
        }
        AlertItemDto item = alertService.createAlert(userPrincipal.getId(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(item);
    }

    @PutMapping("/{id}")
    public ResponseEntity<AlertItemDto> updateAlert(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @PathVariable Long id,
            @Valid @RequestBody UpdateAlertRequest request
    ) {
        if (userPrincipal == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User must be authenticated to update alerts");
        }
        AlertItemDto updated = alertService.updateAlert(userPrincipal.getId(), id, request);
        return ResponseEntity.ok(updated);
    }

    @PatchMapping("/{id}/toggle")
    public ResponseEntity<AlertItemDto> toggleAlert(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @PathVariable Long id
    ) {
        if (userPrincipal == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User must be authenticated to toggle alerts");
        }
        AlertItemDto toggled = alertService.toggleAlertStatus(userPrincipal.getId(), id);
        return ResponseEntity.ok(toggled);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, String>> deleteAlert(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @PathVariable Long id
    ) {
        if (userPrincipal == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User must be authenticated to delete alerts");
        }
        alertService.deleteAlert(userPrincipal.getId(), id);
        return ResponseEntity.ok(Map.of("message", "Alert successfully deleted"));
    }

    @PostMapping("/evaluate")
    public ResponseEntity<AlertsResponseDto> evaluateAlerts(
            @AuthenticationPrincipal UserPrincipal userPrincipal
    ) {
        if (userPrincipal == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User must be authenticated to evaluate alerts");
        }
        AlertsResponseDto response = alertService.getUserAlerts(userPrincipal.getId());
        return ResponseEntity.ok(response);
    }
}
