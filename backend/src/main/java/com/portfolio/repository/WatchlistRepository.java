package com.portfolio.repository;

import com.portfolio.entity.Watchlist;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface WatchlistRepository extends JpaRepository<Watchlist, Long> {
    List<Watchlist> findByUserId(Long userId);
    Optional<Watchlist> findByUserIdAndStockId(Long userId, Long stockId);
    boolean existsByUserIdAndStockId(Long userId, Long stockId);
    void deleteByUserIdAndStockId(Long userId, Long stockId);
}
