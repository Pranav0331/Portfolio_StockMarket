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

    List<AlgoTradeLog> findByStrategyIdAndStatusOrderByCreatedAtDesc(Long strategyId, String status);

    Page<AlgoTradeLog> findByStrategyIdOrderByCreatedAtDesc(Long strategyId, Pageable pageable);

    List<AlgoTradeLog> findByUserIdOrderByCreatedAtDesc(Long userId);

    List<AlgoTradeLog> findByUserIdAndStatusOrderByCreatedAtDesc(Long userId, String status);

    Page<AlgoTradeLog> findByUserIdOrderByCreatedAtDesc(Long userId, Pageable pageable);

    List<AlgoTradeLog> findTop50ByUserIdOrderByCreatedAtDesc(Long userId);

    List<AlgoTradeLog> findTop50ByUserIdAndStatusOrderByCreatedAtDesc(Long userId, String status);

    @org.springframework.data.jpa.repository.Modifying(clearAutomatically = true)
    @org.springframework.data.jpa.repository.Query("DELETE FROM AlgoTradeLog a WHERE a.user.id = :userId")
    void deleteByUserId(@org.springframework.data.repository.query.Param("userId") Long userId);
}

