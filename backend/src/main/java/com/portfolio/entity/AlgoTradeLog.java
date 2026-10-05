package com.portfolio.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "algo_trade_logs")
public class AlgoTradeLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "strategy_id", nullable = false)
    private AlgoStrategy strategy;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, length = 32)
    private String symbol;

    @Column(nullable = false, length = 20)
    private String action; // 'BUY', 'SELL', 'WAIT', 'CLOSE'

    @Column(nullable = false, precision = 19, scale = 4)
    private BigDecimal price;

    @Column(precision = 19, scale = 4)
    private BigDecimal quantity;

    @Column(name = "algo_signal", nullable = false, length = 20)
    private String signal; // 'BUY', 'SELL', 'WAIT'

    @Column(nullable = false, precision = 5, scale = 2)
    private BigDecimal confidence;

    @Column(nullable = false, length = 20)
    private String trend; // 'BULLISH', 'BEARISH', 'NEUTRAL'

    @Column(columnDefinition = "TEXT")
    private String reasons;

    @Column(precision = 19, scale = 4)
    private BigDecimal pnl;

    @Column(name = "order_id")
    private Long orderId;

    @Column(name = "position_id")
    private Long positionId;

    @Column(nullable = false, length = 20)
    private String status = "EXECUTED"; // 'EXECUTED', 'SKIPPED', 'EVALUATED'

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }

    public AlgoTradeLog() {}

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public AlgoStrategy getStrategy() { return strategy; }
    public void setStrategy(AlgoStrategy strategy) { this.strategy = strategy; }

    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }

    public String getSymbol() { return symbol; }
    public void setSymbol(String symbol) { this.symbol = symbol; }

    public String getAction() { return action; }
    public void setAction(String action) { this.action = action; }

    public BigDecimal getPrice() { return price; }
    public void setPrice(BigDecimal price) { this.price = price; }

    public BigDecimal getQuantity() { return quantity; }
    public void setQuantity(BigDecimal quantity) { this.quantity = quantity; }

    public String getSignal() { return signal; }
    public void setSignal(String signal) { this.signal = signal; }

    public BigDecimal getConfidence() { return confidence; }
    public void setConfidence(BigDecimal confidence) { this.confidence = confidence; }

    public String getTrend() { return trend; }
    public void setTrend(String trend) { this.trend = trend; }

    public String getReasons() { return reasons; }
    public void setReasons(String reasons) { this.reasons = reasons; }

    public BigDecimal getPnl() { return pnl; }
    public void setPnl(BigDecimal pnl) { this.pnl = pnl; }

    public Long getOrderId() { return orderId; }
    public void setOrderId(Long orderId) { this.orderId = orderId; }

    public Long getPositionId() { return positionId; }
    public void setPositionId(Long positionId) { this.positionId = positionId; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public LocalDateTime getCreatedAt() { return createdAt; }
}
