package com.portfolio.entity;

import com.portfolio.entity.enums.TradingMode;
import com.portfolio.entity.enums.TransactionStatus;
import com.portfolio.entity.enums.TransactionType;
import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(
    name = "transactions",
    indexes = {
        @Index(name = "idx_transactions_user_id", columnList = "user_id"),
        @Index(name = "idx_transactions_stock_id", columnList = "stock_id"),
        @Index(name = "idx_transactions_order_id", columnList = "order_id")
    }
)
public class Transaction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false, foreignKey = @ForeignKey(name = "fk_transactions_user"))
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "stock_id", foreignKey = @ForeignKey(name = "fk_transactions_stock"))
    private Stock stock;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id", foreignKey = @ForeignKey(name = "fk_transactions_order"))
    private Order order;

    @Enumerated(EnumType.STRING)
    @Column(name = "transaction_type", nullable = false, length = 30)
    private TransactionType transactionType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private TransactionStatus status = TransactionStatus.SUCCESS;

    @Enumerated(EnumType.STRING)
    @Column(name = "trading_mode", nullable = false, length = 32)
    private TradingMode tradingMode = TradingMode.INTRADAY;

    @Enumerated(EnumType.STRING)
    @Column(name = "position_side", length = 10)
    private com.portfolio.entity.enums.PositionSide positionSide;

    @Column(name = "leverage")
    private Integer leverage = 1;

    @Column(name = "margin_used", precision = 19, scale = 4)
    private BigDecimal marginUsed = BigDecimal.ZERO;

    @Column(name = "position_id")
    private Long positionId;

    @Column(precision = 19, scale = 4)
    private BigDecimal quantity;

    @Column(name = "price_per_unit", precision = 19, scale = 4)
    private BigDecimal pricePerUnit;

    @Column(name = "total_amount", nullable = false, precision = 19, scale = 4)
    private BigDecimal totalAmount;

    @Column(precision = 19, scale = 4)
    private BigDecimal fees = BigDecimal.ZERO;

    @Column(precision = 19, scale = 4)
    private BigDecimal pnl;

    @Column(name = "pnl_percent", precision = 19, scale = 4)
    private BigDecimal pnlPercent;

    @Column(name = "avg_buy_price", precision = 19, scale = 4)
    private BigDecimal avgBuyPrice;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    public Transaction() {}

    public Transaction(User user, Stock stock, TransactionType transactionType, BigDecimal totalAmount) {
        this.user = user;
        this.stock = stock;
        this.transactionType = transactionType;
        this.totalAmount = totalAmount;
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

    public Order getOrder() {
        return order;
    }

    public void setOrder(Order order) {
        this.order = order;
    }

    public TransactionType getTransactionType() {
        return transactionType;
    }

    public void setTransactionType(TransactionType transactionType) {
        this.transactionType = transactionType;
    }

    public TransactionStatus getStatus() {
        return status;
    }

    public void setStatus(TransactionStatus status) {
        this.status = status;
    }

    public BigDecimal getQuantity() {
        return quantity;
    }

    public void setQuantity(BigDecimal quantity) {
        this.quantity = quantity;
    }

    public BigDecimal getPricePerUnit() {
        return pricePerUnit;
    }

    public void setPricePerUnit(BigDecimal pricePerUnit) {
        this.pricePerUnit = pricePerUnit;
    }

    public BigDecimal getTotalAmount() {
        return totalAmount;
    }

    public void setTotalAmount(BigDecimal totalAmount) {
        this.totalAmount = totalAmount;
    }

    public BigDecimal getFees() {
        return fees;
    }

    public void setFees(BigDecimal fees) {
        this.fees = fees;
    }

    public BigDecimal getPnl() {
        return pnl;
    }

    public void setPnl(BigDecimal pnl) {
        this.pnl = pnl;
    }

    public BigDecimal getPnlPercent() {
        return pnlPercent;
    }

    public void setPnlPercent(BigDecimal pnlPercent) {
        this.pnlPercent = pnlPercent;
    }

    public BigDecimal getAvgBuyPrice() {
        return avgBuyPrice;
    }

    public void setAvgBuyPrice(BigDecimal avgBuyPrice) {
        this.avgBuyPrice = avgBuyPrice;
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

    public Long getPositionId() {
        return positionId;
    }

    public void setPositionId(Long positionId) {
        this.positionId = positionId;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
