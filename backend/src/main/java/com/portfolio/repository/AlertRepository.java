package com.portfolio.repository;

import com.portfolio.entity.Alert;
import com.portfolio.entity.enums.AlertStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AlertRepository extends JpaRepository<Alert, Long> {
    List<Alert> findByUserId(Long userId);
    List<Alert> findByStockIdAndStatus(Long stockId, AlertStatus status);
}
