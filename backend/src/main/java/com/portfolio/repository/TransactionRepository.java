package com.portfolio.repository;

import com.portfolio.entity.Transaction;
import com.portfolio.entity.enums.TransactionType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;

@Repository
public interface TransactionRepository extends JpaRepository<Transaction, Long> {
    List<Transaction> findByUserId(Long userId);
    List<Transaction> findByUserIdOrderByCreatedAtDesc(Long userId);
    List<Transaction> findByStockId(Long stockId);
    List<Transaction> findAllByOrderByCreatedAtDesc();


    @Query("SELECT t FROM Transaction t " +
           "LEFT JOIN t.stock s " +
           "LEFT JOIN t.order o " +
           "WHERE t.user.id = :userId " +
           "AND (:type IS NULL OR t.transactionType = :type) " +
           "AND (:symbol IS NULL OR LOWER(s.symbol) LIKE LOWER(CONCAT('%', :symbol, '%')) OR LOWER(s.companyName) LIKE LOWER(CONCAT('%', :symbol, '%'))) " +
           "AND (:startDate IS NULL OR t.createdAt >= :startDate) " +
           "AND (:endDate IS NULL OR t.createdAt <= :endDate)")
    Page<Transaction> findUserTransactions(
            @Param("userId") Long userId,
            @Param("type") TransactionType type,
            @Param("symbol") String symbol,
            @Param("startDate") Instant startDate,
            @Param("endDate") Instant endDate,
            Pageable pageable
    );
}
