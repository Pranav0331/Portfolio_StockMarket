package com.portfolio.dto.auth;

public record UserProfileResponse(
    Long id,
    String name,
    String email,
    String role,
    String status
) {}
