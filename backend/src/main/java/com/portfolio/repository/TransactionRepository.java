package com.portfolio.repository;

import com.portfolio.entity.Transaction;
import com.portfolio.entity.enums.TradingMode;
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
    List<Transaction> findByUserIdOrderByCreatedAtAscIdAsc(Long userId);
    List<Transaction> findByStockId(Long stockId);
    List<Transaction> findAllByOrderByCreatedAtDesc();

    @Query("SELECT t FROM Transaction t " +
           "LEFT JOIN t.stock s " +
           "LEFT JOIN t.order o " +
           "WHERE t.user.id = :userId " +
           "AND (:financialOnly = false OR t.transactionType IN (com.portfolio.entity.enums.TransactionType.ACCOUNT_INIT, com.portfolio.entity.enums.TransactionType.DEPOSIT, com.portfolio.entity.enums.TransactionType.WITHDRAWAL, com.portfolio.entity.enums.TransactionType.ACCOUNT_RESET, com.portfolio.entity.enums.TransactionType.DIVIDEND)) " +
           "AND (:tradesOnly = false OR t.transactionType IN (com.portfolio.entity.enums.TransactionType.BUY, com.portfolio.entity.enums.TransactionType.SELL)) " +
           "AND (:type IS NULL OR t.transactionType = :type) " +
           "AND (:tradingMode IS NULL OR t.tradingMode = :tradingMode) " +
           "AND (:symbol IS NULL OR (s IS NOT NULL AND (LOWER(s.symbol) LIKE LOWER(CONCAT('%', :symbol, '%')) OR LOWER(s.companyName) LIKE LOWER(CONCAT('%', :symbol, '%')))) OR (s IS NULL AND (LOWER(CAST(t.transactionType as string)) LIKE LOWER(CONCAT('%', :symbol, '%')) OR LOWER(:symbol) = 'cash'))) " +
           "AND (:startDate IS NULL OR t.createdAt >= :startDate) " +
           "AND (:endDate IS NULL OR t.createdAt <= :endDate)")
    Page<Transaction> findUserTransactions(
            @Param("userId") Long userId,
            @Param("financialOnly") boolean financialOnly,
            @Param("tradesOnly") boolean tradesOnly,
            @Param("type") TransactionType type,
            @Param("tradingMode") TradingMode tradingMode,
            @Param("symbol") String symbol,
            @Param("startDate") Instant startDate,
            @Param("endDate") Instant endDate,
            Pageable pageable
    );

    default Page<Transaction> findUserTransactions(
            Long userId,
            boolean financialOnly,
            TransactionType type,
            TradingMode tradingMode,
            String symbol,
            Instant startDate,
            Instant endDate,
            Pageable pageable
    ) {
        return findUserTransactions(userId, financialOnly, false, type, tradingMode, symbol, startDate, endDate, pageable);
    }

    default Page<Transaction> findUserTransactions(
            Long userId,
            TransactionType type,
            TradingMode tradingMode,
            String symbol,
            Instant startDate,
            Instant endDate,
            Pageable pageable
    ) {
        return findUserTransactions(userId, false, false, type, tradingMode, symbol, startDate, endDate, pageable);
    }

    @org.springframework.data.jpa.repository.Modifying(clearAutomatically = true)
    @org.springframework.data.jpa.repository.Query("DELETE FROM Transaction t WHERE t.user.id = :userId")
    void deleteByUserId(@Param("userId") Long userId);

    @org.springframework.data.jpa.repository.Modifying(clearAutomatically = true)
    @org.springframework.data.jpa.repository.Query("DELETE FROM Transaction t WHERE t.user.id = :userId AND t.transactionType IN (com.portfolio.entity.enums.TransactionType.BUY, com.portfolio.entity.enums.TransactionType.SELL)")
    void deleteTradeExecutionsByUserId(@Param("userId") Long userId);

    @org.springframework.data.jpa.repository.Modifying(clearAutomatically = true)
    @org.springframework.data.jpa.repository.Query("DELETE FROM Transaction t WHERE t.user.id = :userId AND t.transactionType = com.portfolio.entity.enums.TransactionType.ACCOUNT_RESET")
    void deleteAccountResetsByUserId(@Param("userId") Long userId);

    @org.springframework.data.jpa.repository.Modifying(clearAutomatically = true)
    @org.springframework.data.jpa.repository.Query("UPDATE Transaction t SET t.order = null WHERE t.user.id = :userId")
    void detachOrdersByUserId(@Param("userId") Long userId);
}

