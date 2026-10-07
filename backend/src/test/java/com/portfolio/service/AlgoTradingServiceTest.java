package com.portfolio.service;

import com.portfolio.dto.algo.AlgoEvaluationResponseDto;
import com.portfolio.dto.algo.AlgoPerformanceDto;
import com.portfolio.dto.algo.AlgoStrategyRequestDto;
import com.portfolio.dto.algo.AlgoStrategyResponseDto;
import com.portfolio.dto.market.CandleDto;
import com.portfolio.dto.market.CandleSeriesDto;
import com.portfolio.dto.trading.TradeRequestDto;
import com.portfolio.dto.trading.TradeResponseDto;
import com.portfolio.entity.*;
import com.portfolio.entity.enums.*;
import com.portfolio.repository.AlgoStrategyRepository;
import com.portfolio.repository.AlgoTradeLogRepository;
import com.portfolio.repository.PositionRepository;
import com.portfolio.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AlgoTradingServiceTest {

    @Mock
    private AlgoStrategyRepository strategyRepository;

    @Mock
    private AlgoTradeLogRepository tradeLogRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private MarketDataService marketDataService;

    @Mock
    private TradingService tradingService;

    @Mock
    private PositionRepository positionRepository;

    @InjectMocks
    private AlgoTradingService algoTradingService;

    private User testUser;
    private AlgoStrategy testStrategy;

    @BeforeEach
    void setUp() {
        testUser = new User();
        testUser.setId(1L);
        testUser.setFullName("Trader One");
        testUser.setEmail("trader@example.com");

        testStrategy = new AlgoStrategy();
        testStrategy.setId(100L);
        testStrategy.setUser(testUser);
        testStrategy.setName("BTC Trend Scalper");
        testStrategy.setSymbol("BTC/USD");
        testStrategy.setMarket(MarketType.CRYPTO);
        testStrategy.setTradingMode(TradingMode.INTRADAY);
        testStrategy.setTimeframe("15m");
        testStrategy.setDirection(StrategyDirection.BOTH);
        testStrategy.setUseEmaCross(true);
        testStrategy.setEmaFastPeriod(9);
        testStrategy.setEmaSlowPeriod(21);
        testStrategy.setUseRsiFilter(true);
        testStrategy.setRsiPeriod(14);
        testStrategy.setRsiOverbought(new BigDecimal("70.00"));
        testStrategy.setRsiOversold(new BigDecimal("30.00"));
        testStrategy.setUseMacdFilter(true);
        testStrategy.setMacdFast(12);
        testStrategy.setMacdSlow(26);
        testStrategy.setMacdSignal(9);
        testStrategy.setUseBbFilter(false);
        testStrategy.setLeverage(10);
        testStrategy.setQuantity(new BigDecimal("0.1000"));
        testStrategy.setStopLossPct(new BigDecimal("1.50"));
        testStrategy.setTakeProfitPct(new BigDecimal("3.00"));
        testStrategy.setMaxOpenPositions(3);
        testStrategy.setStatus(StrategyStatus.STOPPED);
        testStrategy.setTotalTrades(0);
        testStrategy.setWinningTrades(0);
        testStrategy.setLosingTrades(0);
        testStrategy.setTotalPnl(BigDecimal.ZERO);
    }

    @Test
    void testCreateStrategy() {
        AlgoStrategyRequestDto request = new AlgoStrategyRequestDto(
                "BTC Scalper",
                "BTC/USD",
                MarketType.CRYPTO,
                TradingMode.INTRADAY,
                "15m",
                StrategyDirection.BOTH,
                9, 21, 14,
                new BigDecimal("70.00"),
                new BigDecimal("30.00"),
                12, 26, 9,
                20, new BigDecimal("2.00"),
                true, true, true, false,
                new BigDecimal("2.00"),
                10,
                new BigDecimal("0.1000"),
                new BigDecimal("1.50"),
                new BigDecimal("3.00"),
                3,
                new BigDecimal("500.00")
        );

        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser));
        when(strategyRepository.save(any(AlgoStrategy.class))).thenAnswer(invocation -> {
            AlgoStrategy s = invocation.getArgument(0);
            s.setId(101L);
            return s;
        });

        AlgoStrategyResponseDto response = algoTradingService.createStrategy(1L, request);

        assertNotNull(response);
        assertEquals("BTC Scalper", response.name());
        assertEquals("BTC/USD", response.symbol());
        assertEquals(StrategyStatus.STOPPED, response.status());
    }

    @Test
    void testStartPauseStopStrategyLifecycle() {
        when(strategyRepository.findByIdAndUserId(100L, 1L)).thenReturn(Optional.of(testStrategy));
        when(strategyRepository.save(any(AlgoStrategy.class))).thenAnswer(invocation -> invocation.getArgument(0));

        AlgoStrategyResponseDto running = algoTradingService.startStrategy(1L, 100L);
        assertEquals(StrategyStatus.RUNNING, running.status());

        AlgoStrategyResponseDto paused = algoTradingService.pauseStrategy(1L, 100L);
        assertEquals(StrategyStatus.PAUSED, paused.status());

        AlgoStrategyResponseDto stopped = algoTradingService.stopStrategy(1L, 100L);
        assertEquals(StrategyStatus.STOPPED, stopped.status());
    }

    @Test
    void testEvaluateStrategyWithRealCandles() {
        testStrategy.setStatus(StrategyStatus.RUNNING);
        testStrategy.setUseRsiFilter(false); // Enable clean EMA & MACD confluence
        testStrategy.setUseMacdFilter(false);
        when(strategyRepository.findByIdAndUserId(100L, 1L)).thenReturn(Optional.of(testStrategy));

        // Generate synthetic uptrend candle series
        List<CandleDto> candles = new ArrayList<>();
        double basePrice = 50000.0;
        Instant now = Instant.now();
        for (int i = 0; i < 50; i++) {
            double close = basePrice + (i * 50.0);
            candles.add(new CandleDto(
                    now.minusSeconds((50 - i) * 60).toEpochMilli(),
                    now.minusSeconds((50 - i) * 60).toString(),
                    BigDecimal.valueOf(close - 10),
                    BigDecimal.valueOf(close + 20),
                    BigDecimal.valueOf(close - 20),
                    BigDecimal.valueOf(close),
                    1000L
            ));
        }
        CandleSeriesDto seriesDto = new CandleSeriesDto("BTC/USD", "15m", "USD", "BINANCE", "crypto", candles);
        when(marketDataService.getCandles("BTC/USD", "15m", 80)).thenReturn(seriesDto);
        when(tradingService.getUserPositions(eq(1L), eq("BTC/USD"), eq(PositionStatus.OPEN))).thenReturn(List.of());
        when(tradingService.executeBuy(eq(1L), any(TradeRequestDto.class))).thenReturn(
                new TradeResponseDto(
                        10L, 20L, 30L, "BTC/USD", "Bitcoin",
                        OrderType.BUY, PositionSide.LONG, OrderStatus.EXECUTED, TradingMode.INTRADAY,
                        new BigDecimal("0.1000"),
                        new BigDecimal("52500.00"),
                        new BigDecimal("525.00"),
                        10,
                        new BigDecimal("52.50"),
                        null,
                        null,
                        new BigDecimal("95000.00"),
                        BigDecimal.ZERO,
                        Instant.now(),
                        "EXECUTED"
                )
        );

        AlgoEvaluationResponseDto eval = algoTradingService.evaluateStrategy(1L, 100L, true);

        assertNotNull(eval);
        assertEquals("BTC/USD", eval.symbol());
        assertEquals("BULLISH", eval.trend());
        assertEquals(AlgoSignal.BUY, eval.signal());
        verify(tradeLogRepository, times(1)).save(any(AlgoTradeLog.class));
    }

    @Test
    void testEvaluateStrategyWaitDoesNotCreateTradeLog() {
        testStrategy.setStatus(StrategyStatus.RUNNING);
        testStrategy.setDirection(StrategyDirection.LONG); // Looking only for LONGs
        testStrategy.setUseEmaCross(true);
        testStrategy.setUseRsiFilter(true);
        testStrategy.setUseMacdFilter(true);
        when(strategyRepository.findByIdAndUserId(100L, 1L)).thenReturn(Optional.of(testStrategy));

        // Generate downtrend candle series (causes longScore < longTotal -> WAIT)
        List<CandleDto> candles = new ArrayList<>();
        double basePrice = 50000.0;
        Instant now = Instant.now();
        for (int i = 0; i < 50; i++) {
            double close = basePrice - (i * 20.0);
            candles.add(new CandleDto(
                    now.minusSeconds((50 - i) * 60).toEpochMilli(),
                    now.minusSeconds((50 - i) * 60).toString(),
                    BigDecimal.valueOf(close + 10),
                    BigDecimal.valueOf(close + 20),
                    BigDecimal.valueOf(close - 20),
                    BigDecimal.valueOf(close),
                    1000L
            ));
        }
        CandleSeriesDto seriesDto = new CandleSeriesDto("BTC/USD", "15m", "USD", "BINANCE", "crypto", candles);
        when(marketDataService.getCandles("BTC/USD", "15m", 80)).thenReturn(seriesDto);

        AlgoEvaluationResponseDto eval = algoTradingService.evaluateStrategy(1L, 100L, true);

        assertNotNull(eval);
        assertEquals(AlgoSignal.WAIT, eval.signal());
        assertFalse(eval.tradeExecuted());
        // Verify no buy/sell trade is executed
        verify(tradingService, never()).executeBuy(any(), any());
        verify(tradingService, never()).executeSell(any(), any());
        // Verify NO trade log is saved to DB for WAIT evaluations
        verify(tradeLogRepository, never()).save(any(AlgoTradeLog.class));
    }

    @Test
    void testGetStrategyPerformance() {
        when(strategyRepository.findByIdAndUserId(100L, 1L)).thenReturn(Optional.of(testStrategy));

        AlgoTradeLog log1 = new AlgoTradeLog();
        log1.setId(1L);
        log1.setStatus("EXECUTED");
        log1.setPnl(new BigDecimal("250.00"));

        AlgoTradeLog log2 = new AlgoTradeLog();
        log2.setId(2L);
        log2.setStatus("EXECUTED");
        log2.setPnl(new BigDecimal("-100.00"));

        when(tradeLogRepository.findByStrategyIdAndStatusOrderByCreatedAtDesc(100L, "EXECUTED")).thenReturn(List.of(log1, log2));

        AlgoPerformanceDto perf = algoTradingService.getStrategyPerformance(1L, 100L);

        assertNotNull(perf);
        assertEquals(2, perf.totalTrades());
        assertEquals(1, perf.winningTrades());
        assertEquals(1, perf.losingTrades());
        assertEquals(new BigDecimal("50.00"), perf.winRate());
        assertEquals(new BigDecimal("150.00"), perf.totalPnl());
        assertEquals(new BigDecimal("2.50"), perf.profitFactor());
    }
}
