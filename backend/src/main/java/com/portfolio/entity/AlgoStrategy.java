package com.portfolio.entity;

import com.portfolio.entity.enums.MarketType;
import com.portfolio.entity.enums.StrategyDirection;
import com.portfolio.entity.enums.StrategyStatus;
import com.portfolio.entity.enums.TradingMode;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "algo_strategies")
public class AlgoStrategy {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(nullable = false, length = 32)
    private String symbol;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private MarketType market = MarketType.US;

    @Enumerated(EnumType.STRING)
    @Column(name = "trading_mode", nullable = false, length = 32)
    private TradingMode tradingMode = TradingMode.INTRADAY;

    @Column(nullable = false, length = 16)
    private String timeframe = "5min";

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private StrategyDirection direction = StrategyDirection.BOTH;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private StrategyStatus status = StrategyStatus.STOPPED;

    // Technical Indicator Parameters
    @Column(name = "ema_fast_period", nullable = false)
    private int emaFastPeriod = 9;

    @Column(name = "ema_slow_period", nullable = false)
    private int emaSlowPeriod = 21;

    @Column(name = "rsi_period", nullable = false)
    private int rsiPeriod = 14;

    @Column(name = "rsi_overbought", nullable = false, precision = 10, scale = 2)
    private BigDecimal rsiOverbought = new BigDecimal("70.00");

    @Column(name = "rsi_oversold", nullable = false, precision = 10, scale = 2)
    private BigDecimal rsiOversold = new BigDecimal("30.00");

    @Column(name = "macd_fast", nullable = false)
    private int macdFast = 12;

    @Column(name = "macd_slow", nullable = false)
    private int macdSlow = 26;

    @Column(name = "macd_signal", nullable = false)
    private int macdSignal = 9;

    @Column(name = "bb_period", nullable = false)
    private int bbPeriod = 20;

    @Column(name = "bb_std_dev", nullable = false, precision = 10, scale = 2)
    private BigDecimal bbStdDev = new BigDecimal("2.00");

    // Condition Flags
    @Column(name = "use_ema_cross", nullable = false)
    private boolean useEmaCross = true;

    @Column(name = "use_rsi_filter", nullable = false)
    private boolean useRsiFilter = true;

    @Column(name = "use_macd_filter", nullable = false)
    private boolean useMacdFilter = true;

    @Column(name = "use_bb_filter", nullable = false)
    private boolean useBbFilter = false;

    // Risk Parameters
    @Column(name = "risk_per_trade_pct", nullable = false, precision = 10, scale = 2)
    private BigDecimal riskPerTradePct = new BigDecimal("1.00");

    @Column(nullable = false)
    private int leverage = 10;

    @Column(nullable = false, precision = 19, scale = 4)
    private BigDecimal quantity = new BigDecimal("0.1000");

    @Column(name = "stop_loss_pct", precision = 10, scale = 2)
    private BigDecimal stopLossPct;

    @Column(name = "take_profit_pct", precision = 10, scale = 2)
    private BigDecimal takeProfitPct;

    @Column(name = "max_open_positions", nullable = false)
    private int maxOpenPositions = 1;

    @Column(name = "daily_loss_limit", precision = 19, scale = 4)
    private BigDecimal dailyLossLimit;

    // Performance tracking
    @Column(name = "total_trades", nullable = false)
    private int totalTrades = 0;

    @Column(name = "winning_trades", nullable = false)
    private int winningTrades = 0;

    @Column(name = "losing_trades", nullable = false)
    private int losingTrades = 0;

    @Column(name = "total_pnl", nullable = false, precision = 19, scale = 4)
    private BigDecimal totalPnl = BigDecimal.ZERO;

    @Column(name = "max_drawdown", nullable = false, precision = 10, scale = 2)
    private BigDecimal maxDrawdown = BigDecimal.ZERO;

    @Column(name = "last_run_at")
    private LocalDateTime lastRunAt;

    @Column(name = "last_signal", length = 20)
    private String lastSignal;

    @Column(name = "last_signal_reasons", columnDefinition = "TEXT")
    private String lastSignalReasons;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    public AlgoStrategy() {}

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getSymbol() { return symbol; }
    public void setSymbol(String symbol) { this.symbol = symbol; }

    public MarketType getMarket() { return market; }
    public void setMarket(MarketType market) { this.market = market; }

    public TradingMode getTradingMode() { return tradingMode; }
    public void setTradingMode(TradingMode tradingMode) { this.tradingMode = tradingMode; }

    public String getTimeframe() { return timeframe; }
    public void setTimeframe(String timeframe) { this.timeframe = timeframe; }

    public StrategyDirection getDirection() { return direction; }
    public void setDirection(StrategyDirection direction) { this.direction = direction; }

    public StrategyStatus getStatus() { return status; }
    public void setStatus(StrategyStatus status) { this.status = status; }

    public int getEmaFastPeriod() { return emaFastPeriod; }
    public void setEmaFastPeriod(int emaFastPeriod) { this.emaFastPeriod = emaFastPeriod; }

    public int getEmaSlowPeriod() { return emaSlowPeriod; }
    public void setEmaSlowPeriod(int emaSlowPeriod) { this.emaSlowPeriod = emaSlowPeriod; }

    public int getRsiPeriod() { return rsiPeriod; }
    public void setRsiPeriod(int rsiPeriod) { this.rsiPeriod = rsiPeriod; }

    public BigDecimal getRsiOverbought() { return rsiOverbought; }
    public void setRsiOverbought(BigDecimal rsiOverbought) { this.rsiOverbought = rsiOverbought; }

    public BigDecimal getRsiOversold() { return rsiOversold; }
    public void setRsiOversold(BigDecimal rsiOversold) { this.rsiOversold = rsiOversold; }

    public int getMacdFast() { return macdFast; }
    public void setMacdFast(int macdFast) { this.macdFast = macdFast; }

    public int getMacdSlow() { return macdSlow; }
    public void setMacdSlow(int macdSlow) { this.macdSlow = macdSlow; }

    public int getMacdSignal() { return macdSignal; }
    public void setMacdSignal(int macdSignal) { this.macdSignal = macdSignal; }

    public int getBbPeriod() { return bbPeriod; }
    public void setBbPeriod(int bbPeriod) { this.bbPeriod = bbPeriod; }

    public BigDecimal getBbStdDev() { return bbStdDev; }
    public void setBbStdDev(BigDecimal bbStdDev) { this.bbStdDev = bbStdDev; }

    public boolean isUseEmaCross() { return useEmaCross; }
    public void setUseEmaCross(boolean useEmaCross) { this.useEmaCross = useEmaCross; }

    public boolean isUseRsiFilter() { return useRsiFilter; }
    public void setUseRsiFilter(boolean useRsiFilter) { this.useRsiFilter = useRsiFilter; }

    public boolean isUseMacdFilter() { return useMacdFilter; }
    public void setUseMacdFilter(boolean useMacdFilter) { this.useMacdFilter = useMacdFilter; }

    public boolean isUseBbFilter() { return useBbFilter; }
    public void setUseBbFilter(boolean useBbFilter) { this.useBbFilter = useBbFilter; }

    public BigDecimal getRiskPerTradePct() { return riskPerTradePct; }
    public void setRiskPerTradePct(BigDecimal riskPerTradePct) { this.riskPerTradePct = riskPerTradePct; }

    public int getLeverage() { return leverage; }
    public void setLeverage(int leverage) { this.leverage = leverage; }

    public BigDecimal getQuantity() { return quantity; }
    public void setQuantity(BigDecimal quantity) { this.quantity = quantity; }

    public BigDecimal getStopLossPct() { return stopLossPct; }
    public void setStopLossPct(BigDecimal stopLossPct) { this.stopLossPct = stopLossPct; }

    public BigDecimal getTakeProfitPct() { return takeProfitPct; }
    public void setTakeProfitPct(BigDecimal takeProfitPct) { this.takeProfitPct = takeProfitPct; }

    public int getMaxOpenPositions() { return maxOpenPositions; }
    public void setMaxOpenPositions(int maxOpenPositions) { this.maxOpenPositions = maxOpenPositions; }

    public BigDecimal getDailyLossLimit() { return dailyLossLimit; }
    public void setDailyLossLimit(BigDecimal dailyLossLimit) { this.dailyLossLimit = dailyLossLimit; }

    public int getTotalTrades() { return totalTrades; }
    public void setTotalTrades(int totalTrades) { this.totalTrades = totalTrades; }

    public int getWinningTrades() { return winningTrades; }
    public void setWinningTrades(int winningTrades) { this.winningTrades = winningTrades; }

    public int getLosingTrades() { return losingTrades; }
    public void setLosingTrades(int losingTrades) { this.losingTrades = losingTrades; }

    public BigDecimal getTotalPnl() { return totalPnl; }
    public void setTotalPnl(BigDecimal totalPnl) { this.totalPnl = totalPnl; }

    public BigDecimal getMaxDrawdown() { return maxDrawdown; }
    public void setMaxDrawdown(BigDecimal maxDrawdown) { this.maxDrawdown = maxDrawdown; }

    public LocalDateTime getLastRunAt() { return lastRunAt; }
    public void setLastRunAt(LocalDateTime lastRunAt) { this.lastRunAt = lastRunAt; }

    public String getLastSignal() { return lastSignal; }
    public void setLastSignal(String lastSignal) { this.lastSignal = lastSignal; }

    public String getLastSignalReasons() { return lastSignalReasons; }
    public void setLastSignalReasons(String lastSignalReasons) { this.lastSignalReasons = lastSignalReasons; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
