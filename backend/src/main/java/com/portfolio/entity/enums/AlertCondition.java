package com.portfolio.entity.enums;

public enum AlertCondition {
    ABOVE,
    BELOW,
    GREATER_THAN_OR_EQUAL,
    LESS_THAN_OR_EQUAL;

    public static AlertCondition fromString(String value) {
        if (value == null || value.trim().isEmpty()) {
            return ABOVE;
        }
        String upper = value.trim().toUpperCase();
        if (upper.equals("ABOVE") || upper.equals("GREATER_THAN") || upper.equals("GREATER_THAN_OR_EQUAL") || upper.equals("GTE") || upper.equals("GT") || upper.equals(">=") || upper.equals(">")) {
            return ABOVE;
        }
        if (upper.equals("BELOW") || upper.equals("LESS_THAN") || upper.equals("LESS_THAN_OR_EQUAL") || upper.equals("LTE") || upper.equals("LT") || upper.equals("<=") || upper.equals("<")) {
            return BELOW;
        }
        return AlertCondition.valueOf(upper);
    }
}

