package com.portfolio.entity.enums;

public enum AlertStatus {
    ACTIVE,
    TRIGGERED,
    DISABLED,
    INACTIVE;

    public static AlertStatus fromString(String value) {
        if (value == null || value.trim().isEmpty()) {
            return ACTIVE;
        }
        String upper = value.trim().toUpperCase();
        if (upper.equals("INACTIVE") || upper.equals("DISABLED")) {
            return DISABLED;
        }
        return AlertStatus.valueOf(upper);
    }
}

