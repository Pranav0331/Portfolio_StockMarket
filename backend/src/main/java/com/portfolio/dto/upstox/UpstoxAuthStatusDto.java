package com.portfolio.dto.upstox;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record UpstoxAuthStatusDto(
        boolean connected,
        String userName,
        String userId,
        String email,
        String userType,
        String broker,
        Long connectedAt,
        String message
) {
    public static UpstoxAuthStatusDto disconnected(String message) {
        return new UpstoxAuthStatusDto(false, null, null, null, null, null, null, message);
    }

    public static UpstoxAuthStatusDto connected(String userName, String userId, String email, String userType, String broker, Long connectedAt) {
        return new UpstoxAuthStatusDto(true, userName, userId, email, userType, broker, connectedAt, "Connected to Upstox");
    }
}
