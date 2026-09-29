package com.portfolio.controller;

import com.portfolio.dto.HealthResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;

@RestController
@RequestMapping("/api/health")
public class HealthController {

    @GetMapping
    public ResponseEntity<HealthResponse> getHealth() {
        HealthResponse response = new HealthResponse(
            "UP",
            "portfolio-stockmarket-backend",
            Instant.now(),
            "Backend service is healthy and running"
        );
        return ResponseEntity.ok(response);
    }
}
