package com.portfolio.repository;

import com.portfolio.entity.AlgoStrategy;
import com.portfolio.entity.enums.StrategyStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AlgoStrategyRepository extends JpaRepository<AlgoStrategy, Long> {

    List<AlgoStrategy> findByUserIdOrderByCreatedAtDesc(Long userId);

    List<AlgoStrategy> findByUserIdAndStatus(Long userId, StrategyStatus status);

    Optional<AlgoStrategy> findByIdAndUserId(Long id, Long userId);

    List<AlgoStrategy> findByStatus(StrategyStatus status);
}
