package com.portfolio.controller;

import com.portfolio.dto.risk.PortfolioRiskDto;
import com.portfolio.security.UserPrincipal;
import com.portfolio.service.RiskManagementService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/portfolio/risk")
public class RiskController {

    private final RiskManagementService riskManagementService;

    public RiskController(RiskManagementService riskManagementService) {
        this.riskManagementService = riskManagementService;
    }

    @GetMapping
    public ResponseEntity<PortfolioRiskDto> getPortfolioRisk(
            @AuthenticationPrincipal UserPrincipal userPrincipal
    ) {
        if (userPrincipal == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User must be authenticated to view portfolio risk analysis");
        }
        PortfolioRiskDto riskDto = riskManagementService.calculatePortfolioRisk(userPrincipal.getId());
        return ResponseEntity.ok(riskDto);
    }
}
