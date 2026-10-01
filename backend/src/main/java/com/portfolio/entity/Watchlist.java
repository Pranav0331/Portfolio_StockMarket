package com.portfolio.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

@Entity
@Table(
    name = "watchlist",
    uniqueConstraints = {
        @UniqueConstraint(name = "uk_watchlist_user_stock", columnNames = {"user_id", "stock_id"})
    },
    indexes = {
        @Index(name = "idx_watchlist_user_id", columnList = "user_id"),
        @Index(name = "idx_watchlist_stock_id", columnList = "stock_id")
    }
)
public class Watchlist {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false, foreignKey = @ForeignKey(name = "fk_watchlist_user"))
    private User user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "stock_id", nullable = false, foreignKey = @ForeignKey(name = "fk_watchlist_stock"))
    private Stock stock;

    @Column(length = 20)
    private String category = "STOCKS";

    @Column(name = "display_order")
    private Integer displayOrder = 0;

    @Column(length = 500)
    private String notes;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    public Watchlist() {}

    public Watchlist(User user, Stock stock) {
        this.user = user;
        this.stock = stock;
    }

    public Watchlist(User user, Stock stock, String category, Integer displayOrder) {
        this.user = user;
        this.stock = stock;
        this.category = category != null ? category : "STOCKS";
        this.displayOrder = displayOrder != null ? displayOrder : 0;
    }

    public Watchlist(User user, Stock stock, String notes) {
        this.user = user;
        this.stock = stock;
        this.notes = notes;
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

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public Integer getDisplayOrder() {
        return displayOrder;
    }

    public void setDisplayOrder(Integer displayOrder) {
        this.displayOrder = displayOrder;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
