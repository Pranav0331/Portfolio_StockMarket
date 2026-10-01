package com.portfolio.dto.admin;

import jakarta.validation.constraints.NotBlank;

public record UpdateUserRoleRequest(
        @NotBlank(message = "Role is required (ROLE_USER, ROLE_ADMIN, USER, ADMIN)")
        String role
) {}
