package com.portfolio.repository;

import com.portfolio.entity.AlgoTradeLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AlgoTradeLogRepository extends JpaRepository<AlgoTradeLog, Long> {

    List<AlgoTradeLog> findByStrategyIdOrderByCreatedAtDesc(Long strategyId);

    Page<AlgoTradeLog> findByStrategyIdOrderByCreatedAtDesc(Long strategyId, Pageable pageable);

    List<AlgoTradeLog> findByUserIdOrderByCreatedAtDesc(Long userId);

    Page<AlgoTradeLog> findByUserIdOrderByCreatedAtDesc(Long userId, Pageable pageable);

    List<AlgoTradeLog> findTop50ByUserIdOrderByCreatedAtDesc(Long userId);
}
