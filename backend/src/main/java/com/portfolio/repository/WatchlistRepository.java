package com.portfolio.repository;

import com.portfolio.entity.Watchlist;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface WatchlistRepository extends JpaRepository<Watchlist, Long> {

    List<Watchlist> findByUserId(Long userId);

    List<Watchlist> findByUserIdOrderByDisplayOrderAscCreatedAtAsc(Long userId);

    List<Watchlist> findByUserIdAndCategoryOrderByDisplayOrderAscCreatedAtAsc(Long userId, String category);

    Optional<Watchlist> findByUserIdAndStockId(Long userId, Long stockId);

    Optional<Watchlist> findByIdAndUserId(Long id, Long userId);

    @Query("SELECT w FROM Watchlist w WHERE w.user.id = :userId AND UPPER(w.stock.symbol) = UPPER(:symbol)")
    Optional<Watchlist> findByUserIdAndSymbol(@Param("userId") Long userId, @Param("symbol") String symbol);

    boolean existsByUserIdAndStockId(Long userId, Long stockId);

    @Query("SELECT COUNT(w) > 0 FROM Watchlist w WHERE w.user.id = :userId AND UPPER(w.stock.symbol) = UPPER(:symbol)")
    boolean existsByUserIdAndSymbol(@Param("userId") Long userId, @Param("symbol") String symbol);

    void deleteByUserIdAndStockId(Long userId, Long stockId);

    @Modifying
    @Query("DELETE FROM Watchlist w WHERE w.user.id = :userId AND UPPER(w.stock.symbol) = UPPER(:symbol)")
    void deleteByUserIdAndSymbol(@Param("userId") Long userId, @Param("symbol") String symbol);
}
