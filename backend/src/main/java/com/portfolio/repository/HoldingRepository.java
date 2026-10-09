package com.portfolio.repository;

import com.portfolio.entity.Holding;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface HoldingRepository extends JpaRepository<Holding, Long> {
    List<Holding> findByUserId(Long userId);
    Optional<Holding> findByIdAndUserId(Long id, Long userId);
    Optional<Holding> findByUserIdAndStockId(Long userId, Long stockId);
    Optional<Holding> findByUserIdAndStock_Symbol(Long userId, String symbol);
}
