package com.portfolio.entity;

import com.portfolio.entity.enums.OrderStatus;
import com.portfolio.entity.enums.OrderType;
import com.portfolio.entity.enums.TradingMode;
import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(
    name = "orders",
    indexes = {
        @Index(name = "idx_orders_user_id", columnList = "user_id"),
        @Index(name = "idx_orders_stock_id", columnList = "stock_id"),
        @Index(name = "idx_orders_status", columnList = "order_status")
    }
)
public class Order {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false, foreignKey = @ForeignKey(name = "fk_orders_user"))
    private User user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "stock_id", nullable = false, foreignKey = @ForeignKey(name = "fk_orders_stock"))
    private Stock stock;

    @Enumerated(EnumType.STRING)
    @Column(name = "order_type", nullable = false, length = 20)
    private OrderType orderType;

    @Enumerated(EnumType.STRING)
    @Column(name = "order_status", nullable = false, length = 30)
    private OrderStatus orderStatus = OrderStatus.PENDING;

    @Enumerated(EnumType.STRING)
    @Column(name = "trading_mode", nullable = false, length = 32)
    private TradingMode tradingMode = TradingMode.INTRADAY;

    @Enumerated(EnumType.STRING)
    @Column(name = "position_side", nullable = false, length = 10)
    private com.portfolio.entity.enums.PositionSide positionSide = com.portfolio.entity.enums.PositionSide.LONG;

    @Column(name = "leverage", nullable = false)
    private Integer leverage = 1;

    @Column(name = "margin_used", nullable = false, precision = 19, scale = 4)
    private BigDecimal marginUsed = BigDecimal.ZERO;

    @Column(name = "stop_loss", precision = 19, scale = 4)
    private BigDecimal stopLoss;

    @Column(name = "take_profit", precision = 19, scale = 4)
    private BigDecimal takeProfit;

    @Column(name = "position_id")
    private Long positionId;

    @Column(name = "realized_pnl", precision = 19, scale = 4)
    private BigDecimal realizedPnl;

    @Column(nullable = false, precision = 19, scale = 4)
    private BigDecimal quantity;

    @Column(nullable = false, precision = 19, scale = 4)
    private BigDecimal price;

    @Column(name = "executed_price", precision = 19, scale = 4)
    private BigDecimal executedPrice;

    @Column(name = "executed_at")
    private Instant executedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public Order() {}

    public Order(User user, Stock stock, OrderType orderType, BigDecimal quantity, BigDecimal price) {
        this.user = user;
        this.stock = stock;
        this.orderType = orderType;
        this.quantity = quantity;
        this.price = price;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public User getUser() {
        return user;
    }

    public void setUser(User user) {
        this.user = user;
    }

    public Stock getStock() {
        return stock;
    }

    public void setStock(Stock stock) {
        this.stock = stock;
    }

    public OrderType getOrderType() {
        return orderType;
    }

    public void setOrderType(OrderType orderType) {
        this.orderType = orderType;
    }

    public OrderStatus getOrderStatus() {
        return orderStatus;
    }

    public void setOrderStatus(OrderStatus orderStatus) {
        this.orderStatus = orderStatus;
    }

    public BigDecimal getQuantity() {
        return quantity;
    }

    public void setQuantity(BigDecimal quantity) {
        this.quantity = quantity;
    }

    public BigDecimal getPrice() {
        return price;
    }

    public void setPrice(BigDecimal price) {
        this.price = price;
    }

    public BigDecimal getExecutedPrice() {
        return executedPrice;
    }

    public void setExecutedPrice(BigDecimal executedPrice) {
        this.executedPrice = executedPrice;
    }

    public Instant getExecutedAt() {
        return executedAt;
    }

    public void setExecutedAt(Instant executedAt) {
        this.executedAt = executedAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public TradingMode getTradingMode() {
        return tradingMode;
    }

    public void setTradingMode(TradingMode tradingMode) {
        this.tradingMode = tradingMode;
    }

    public com.portfolio.entity.enums.PositionSide getPositionSide() {
        return positionSide;
    }

    public void setPositionSide(com.portfolio.entity.enums.PositionSide positionSide) {
        this.positionSide = positionSide;
    }

    public Integer getLeverage() {
        return leverage;
    }

    public void setLeverage(Integer leverage) {
        this.leverage = leverage;
    }

    public BigDecimal getMarginUsed() {
        return marginUsed;
    }

    public void setMarginUsed(BigDecimal marginUsed) {
        this.marginUsed = marginUsed;
    }

    public BigDecimal getStopLoss() {
        return stopLoss;
    }

    public void setStopLoss(BigDecimal stopLoss) {
        this.stopLoss = stopLoss;
    }

    public BigDecimal getTakeProfit() {
        return takeProfit;
    }

    public void setTakeProfit(BigDecimal takeProfit) {
        this.takeProfit = takeProfit;
    }

    public Long getPositionId() {
        return positionId;
    }

    public void setPositionId(Long positionId) {
        this.positionId = positionId;
    }

    public BigDecimal getRealizedPnl() {
        return realizedPnl;
    }

    public void setRealizedPnl(BigDecimal realizedPnl) {
        this.realizedPnl = realizedPnl;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }
}
