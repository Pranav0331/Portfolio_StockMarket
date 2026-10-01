package com.portfolio.dto.alert;

import java.util.List;

public record AlertsResponseDto(
        List<AlertItemDto> alerts,
        int totalCount,
        int activeCount,
        int triggeredCount,
        int disabledCount,
        Long lastEvaluatedAt
) {}
