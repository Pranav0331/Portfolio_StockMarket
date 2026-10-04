package com.portfolio.repository;

import com.portfolio.entity.Position;
import com.portfolio.entity.enums.PositionStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PositionRepository extends JpaRepository<Position, Long> {

    List<Position> findByUserIdAndStatus(Long userId, PositionStatus status);

    List<Position> findByUserId(Long userId);

    List<Position> findByUserIdAndStock_SymbolAndStatus(Long userId, String symbol, PositionStatus status);

    Optional<Position> findByIdAndUserId(Long id, Long userId);

    List<Position> findByStatus(PositionStatus status);

    @Query("SELECT p FROM Position p WHERE p.user.id = :userId AND (:symbol IS NULL OR UPPER(p.stock.symbol) = UPPER(:symbol)) AND (:status IS NULL OR p.status = :status) ORDER BY p.createdAt DESC")
    List<Position> findFiltered(
            @Param("userId") Long userId,
            @Param("symbol") String symbol,
            @Param("status") PositionStatus status
    );
}
