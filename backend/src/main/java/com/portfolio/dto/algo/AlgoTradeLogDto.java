package com.portfolio.dto.algo;

import com.portfolio.entity.AlgoTradeLog;
import java.math.BigDecimal;
import java.time.LocalDateTime;

public record AlgoTradeLogDto(
        Long id,
        Long strategyId,
        String symbol,
        String action,
        BigDecimal price,
        BigDecimal quantity,
        String signal,
        BigDecimal confidence,
        String trend,
        String reasons,
        BigDecimal pnl,
        Long orderId,
        Long positionId,
        String status,
        LocalDateTime createdAt
) {
    public static AlgoTradeLogDto fromEntity(AlgoTradeLog log) {
        return new AlgoTradeLogDto(
                log.getId(),
                log.getStrategy() != null ? log.getStrategy().getId() : null,
                log.getSymbol(),
                log.getAction(),
                log.getPrice(),
                log.getQuantity(),
                log.getSignal(),
                log.getConfidence(),
                log.getTrend(),
                log.getReasons(),
                log.getPnl(),
                log.getOrderId(),
                log.getPositionId(),
                log.getStatus(),
                log.getCreatedAt()
        );
    }
}
