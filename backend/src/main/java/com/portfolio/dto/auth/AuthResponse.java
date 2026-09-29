package com.portfolio.dto.auth;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record AuthResponse(
    String token,
    String type,
    Long id,
    String name,
    String email,
    String role,
    String message
) {
    public AuthResponse(String token, Long id, String name, String email, String role, String message) {
        this(token, "Bearer", id, name, email, role, message);
    }

    public AuthResponse(Long id, String name, String email, String role, String message) {
        this(null, null, id, name, email, role, message);
    }
}
