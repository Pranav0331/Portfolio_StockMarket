package com.portfolio.repository;

import com.portfolio.entity.Order;
import com.portfolio.entity.enums.OrderStatus;
import com.portfolio.entity.enums.OrderType;
import com.portfolio.entity.enums.TradingMode;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;

@Repository
public interface OrderRepository extends JpaRepository<Order, Long> {
    List<Order> findByUserId(Long userId);
    List<Order> findByUserIdAndOrderStatus(Long userId, OrderStatus orderStatus);
    List<Order> findByStockId(Long stockId);
    List<Order> findAllByOrderByCreatedAtDesc();

    @Query("SELECT o FROM Order o " +
           "LEFT JOIN o.stock s " +
           "WHERE o.user.id = :userId " +
           "AND (:orderType IS NULL OR o.orderType = :orderType) " +
           "AND (:orderStatus IS NULL OR o.orderStatus = :orderStatus) " +
           "AND (:tradingMode IS NULL OR o.tradingMode = :tradingMode) " +
           "AND (:symbol IS NULL OR LOWER(s.symbol) LIKE LOWER(CONCAT('%', :symbol, '%')) OR LOWER(s.companyName) LIKE LOWER(CONCAT('%', :symbol, '%'))) " +
           "AND (:startDate IS NULL OR o.createdAt >= :startDate) " +
           "AND (:endDate IS NULL OR o.createdAt <= :endDate)")
    Page<Order> findUserOrders(
            @Param("userId") Long userId,
            @Param("orderType") OrderType orderType,
            @Param("orderStatus") OrderStatus orderStatus,
            @Param("tradingMode") TradingMode tradingMode,
            @Param("symbol") String symbol,
            @Param("startDate") Instant startDate,
            @Param("endDate") Instant endDate,
            Pageable pageable
    );
}
