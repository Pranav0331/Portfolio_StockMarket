package com.portfolio.entity;

import com.portfolio.entity.enums.PositionSide;
import com.portfolio.entity.enums.PositionStatus;
import com.portfolio.entity.enums.TradingMode;
import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(
    name = "positions",
    indexes = {
        @Index(name = "idx_positions_user_id", columnList = "user_id"),
        @Index(name = "idx_positions_stock_id", columnList = "stock_id"),
        @Index(name = "idx_positions_status", columnList = "status"),
        @Index(name = "idx_positions_user_status", columnList = "user_id, status")
    }
)
public class Position {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false, foreignKey = @ForeignKey(name = "fk_positions_user"))
    private User user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "stock_id", nullable = false, foreignKey = @ForeignKey(name = "fk_positions_stock"))
    private Stock stock;

    @Enumerated(EnumType.STRING)
    @Column(name = "side", nullable = false, length = 10)
    private PositionSide side = PositionSide.LONG;

    @Enumerated(EnumType.STRING)
    @Column(name = "trading_mode", nullable = false, length = 32)
    private TradingMode tradingMode = TradingMode.INTRADAY;

    @Column(name = "quantity", nullable = false, precision = 19, scale = 4)
    private BigDecimal quantity;

    @Column(name = "entry_price", nullable = false, precision = 19, scale = 4)
    private BigDecimal entryPrice;

    @Column(name = "leverage", nullable = false)
    private Integer leverage = 1;

    @Column(name = "margin_used", nullable = false, precision = 19, scale = 4)
    private BigDecimal marginUsed = BigDecimal.ZERO;

    @Column(name = "stop_loss", precision = 19, scale = 4)
    private BigDecimal stopLoss;

    @Column(name = "take_profit", precision = 19, scale = 4)
    private BigDecimal takeProfit;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private PositionStatus status = PositionStatus.OPEN;

    @Column(name = "close_price", precision = 19, scale = 4)
    private BigDecimal closePrice;

    @Column(name = "close_time")
    private Instant closeTime;

    @Column(name = "realized_pnl", precision = 19, scale = 4)
    private BigDecimal realizedPnl;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public Position() {}

    public Position(
            User user,
            Stock stock,
            PositionSide side,
            TradingMode tradingMode,
            BigDecimal quantity,
            BigDecimal entryPrice,
            Integer leverage,
            BigDecimal marginUsed,
            BigDecimal stopLoss,
            BigDecimal takeProfit
    ) {
        this.user = user;
        this.stock = stock;
        this.side = side != null ? side : PositionSide.LONG;
        this.tradingMode = tradingMode != null ? tradingMode : TradingMode.INTRADAY;
        this.quantity = quantity;
        this.entryPrice = entryPrice;
        this.leverage = leverage != null && leverage > 0 ? leverage : 1;
        this.marginUsed = marginUsed != null ? marginUsed : BigDecimal.ZERO;
        this.stopLoss = stopLoss;
        this.takeProfit = takeProfit;
        this.status = PositionStatus.OPEN;
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

    public PositionSide getSide() {
        return side;
    }

    public void setSide(PositionSide side) {
        this.side = side;
    }

    public TradingMode getTradingMode() {
        return tradingMode;
    }

    public void setTradingMode(TradingMode tradingMode) {
        this.tradingMode = tradingMode;
    }

    public BigDecimal getQuantity() {
        return quantity;
    }

    public void setQuantity(BigDecimal quantity) {
        this.quantity = quantity;
    }

    public BigDecimal getEntryPrice() {
        return entryPrice;
    }

    public void setEntryPrice(BigDecimal entryPrice) {
        this.entryPrice = entryPrice;
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

    public PositionStatus getStatus() {
        return status;
    }

    public void setStatus(PositionStatus status) {
        this.status = status;
    }

    public BigDecimal getClosePrice() {
        return closePrice;
    }

    public void setClosePrice(BigDecimal closePrice) {
        this.closePrice = closePrice;
    }

    public Instant getCloseTime() {
        return closeTime;
    }

    public void setCloseTime(Instant closeTime) {
        this.closeTime = closeTime;
    }

    public BigDecimal getRealizedPnl() {
        return realizedPnl;
    }

    public void setRealizedPnl(BigDecimal realizedPnl) {
        this.realizedPnl = realizedPnl;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }
}
