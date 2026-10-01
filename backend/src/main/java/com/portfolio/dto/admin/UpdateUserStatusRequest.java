package com.portfolio.dto.admin;

import jakarta.validation.constraints.NotBlank;

public record UpdateUserStatusRequest(
        @NotBlank(message = "Status is required (ACTIVE, INACTIVE, SUSPENDED)")
        String status
) {}
