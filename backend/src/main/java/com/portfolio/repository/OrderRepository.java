package com.portfolio.repository;

import com.portfolio.entity.Order;
import com.portfolio.entity.enums.OrderStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface OrderRepository extends JpaRepository<Order, Long> {
    List<Order> findByUserId(Long userId);
    List<Order> findByUserIdAndOrderStatus(Long userId, OrderStatus orderStatus);
    List<Order> findByStockId(Long stockId);
}
