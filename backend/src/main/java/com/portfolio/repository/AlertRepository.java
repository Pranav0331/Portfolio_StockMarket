package com.portfolio.repository;

import com.portfolio.entity.Alert;
import com.portfolio.entity.enums.AlertCondition;
import com.portfolio.entity.enums.AlertStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

@Repository
public interface AlertRepository extends JpaRepository<Alert, Long> {
    List<Alert> findByUserId(Long userId);
    List<Alert> findByUserIdOrderByCreatedAtDesc(Long userId);
    List<Alert> findByUserIdAndStatusOrderByCreatedAtDesc(Long userId, AlertStatus status);
    Optional<Alert> findByIdAndUserId(Long id, Long userId);
    List<Alert> findByStockIdAndStatus(Long stockId, AlertStatus status);
    List<Alert> findByUserIdAndStockSymbol(Long userId, String symbol);
    boolean existsByUserIdAndStockSymbolAndConditionTypeAndTargetPriceAndStatus(
            Long userId, String symbol, AlertCondition conditionType, BigDecimal targetPrice, AlertStatus status);
    void deleteByIdAndUserId(Long id, Long userId);
}

