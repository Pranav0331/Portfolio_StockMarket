package com.portfolio.service;

import com.portfolio.dto.market.CandleDto;
import com.portfolio.dto.market.CandleSeriesDto;
import com.portfolio.dto.portfolio.PortfolioSummaryDto;
import com.portfolio.dto.risk.HistoricalRiskPointDto;
import com.portfolio.dto.risk.HoldingRiskDto;
import com.portfolio.dto.risk.PortfolioRiskDto;
import com.portfolio.dto.risk.RiskExposureDto;
import com.portfolio.dto.trading.UserHoldingDto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class RiskManagementService {

    private static final Logger log = LoggerFactory.getLogger(RiskManagementService.class);

    private static final double SQRT_252 = Math.sqrt(252.0);
    private static final double Z_95 = 1.6448536269514722; // 95% one-tailed normal critical value

    private final PortfolioService portfolioService;
    private final MarketDataService marketDataService;

    public RiskManagementService(PortfolioService portfolioService, MarketDataService marketDataService) {
        this.portfolioService = portfolioService;
        this.marketDataService = marketDataService;
    }

    @Transactional(readOnly = true)
    public PortfolioRiskDto calculatePortfolioRisk(Long userId) {
        if (userId == null) {
            throw new IllegalArgumentException("User ID is required to calculate risk");
        }

        PortfolioSummaryDto summary = portfolioService.getPortfolioSummary(userId);
        List<UserHoldingDto> activeHoldings = summary.holdings() != null
                ? summary.holdings().stream()
                .filter(h -> h.quantity() != null && h.quantity().compareTo(BigDecimal.ZERO) > 0)
                .collect(Collectors.toList())
                : Collections.emptyList();

        BigDecimal totalInvested = summary.totalInvested() != null ? summary.totalInvested() : BigDecimal.ZERO;
        BigDecimal equityMarketValue = summary.totalHoldingsMarketValue() != null ? summary.totalHoldingsMarketValue() : BigDecimal.ZERO;
        BigDecimal cashBalance = summary.cashBalance() != null ? summary.cashBalance() : BigDecimal.ZERO;
        BigDecimal totalPortfolioValue = summary.totalPortfolioValue() != null ? summary.totalPortfolioValue() : BigDecimal.ZERO;

        BigDecimal equityAllocationPercent = BigDecimal.ZERO;
        BigDecimal cashAllocationPercent = BigDecimal.ZERO;
        if (totalPortfolioValue.compareTo(BigDecimal.ZERO) > 0) {
            equityAllocationPercent = equityMarketValue.divide(totalPortfolioValue, 4, RoundingMode.HALF_UP)
                    .multiply(BigDecimal.valueOf(100)).setScale(2, RoundingMode.HALF_UP);
            cashAllocationPercent = cashBalance.divide(totalPortfolioValue, 4, RoundingMode.HALF_UP)
                    .multiply(BigDecimal.valueOf(100)).setScale(2, RoundingMode.HALF_UP);
        }

        // Empty Portfolio Handling
        if (activeHoldings.isEmpty() || equityMarketValue.compareTo(BigDecimal.ZERO) <= 0) {
            RiskExposureDto exposure = new RiskExposureDto(
                    totalInvested,
                    equityMarketValue,
                    cashBalance,
                    totalPortfolioValue,
                    equityAllocationPercent,
                    cashAllocationPercent,
                    BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP),
                    BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP)
            );

            return new PortfolioRiskDto(
                    exposure,
                    BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP),
                    BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP),
                    BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP),
                    BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP),
                    BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP),
                    BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP),
                    "No Active Holdings",
                    null,
                    "Data unavailable",
                    false,
                    Collections.emptyList(),
                    Collections.emptyList(),
                    System.currentTimeMillis(),
                    "Live Portfolio Holdings & Real Market Data",
                    true,
                    true,
                    "Portfolio has no active stock holdings. Virtual cash balance is active."
            );
        }

        // Calculate holding weights relative to total equity market value
        List<HoldingAnalysis> analyzedHoldings = new ArrayList<>();
        Map<String, List<CandleDto>> candleMap = new HashMap<>();

        for (UserHoldingDto h : activeHoldings) {
            BigDecimal holdingVal = h.currentValue() != null ? h.currentValue() : BigDecimal.ZERO;
            BigDecimal weight = equityMarketValue.compareTo(BigDecimal.ZERO) > 0
                    ? holdingVal.divide(equityMarketValue, 6, RoundingMode.HALF_UP)
                    : BigDecimal.ZERO;

            List<CandleDto> candles = fetchCandlesSafely(h.symbol());
            candleMap.put(h.symbol(), candles);

            HoldingAnalysis analysis = analyzeHolding(h, weight, candles);
            analyzedHoldings.add(analysis);
        }

        // Concentration Metrics (HHI, Top 1, Top 3, Effective N)
        List<BigDecimal> weightsPercent = analyzedHoldings.stream()
                .map(a -> a.weightPercent)
                .sorted(Comparator.reverseOrder())
                .collect(Collectors.toList());

        BigDecimal hhi = BigDecimal.ZERO;
        BigDecimal sumWeightsSquared = BigDecimal.ZERO;
        for (HoldingAnalysis a : analyzedHoldings) {
            BigDecimal wFraction = a.weight; // fraction 0..1
            BigDecimal wPct = a.weightPercent; // 0..100
            hhi = hhi.add(wPct.multiply(wPct));
            sumWeightsSquared = sumWeightsSquared.add(wFraction.multiply(wFraction));
        }
        hhi = hhi.setScale(2, RoundingMode.HALF_UP);

        BigDecimal top1Weight = !weightsPercent.isEmpty() ? weightsPercent.get(0).setScale(2, RoundingMode.HALF_UP) : BigDecimal.ZERO;
        BigDecimal top3Weight = BigDecimal.ZERO;
        for (int i = 0; i < Math.min(3, weightsPercent.size()); i++) {
            top3Weight = top3Weight.add(weightsPercent.get(i));
        }
        top3Weight = top3Weight.setScale(2, RoundingMode.HALF_UP);

        BigDecimal effectiveN = sumWeightsSquared.compareTo(BigDecimal.ZERO) > 0
                ? BigDecimal.ONE.divide(sumWeightsSquared, 2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        String diversificationRating = classifyDiversification(hhi, analyzedHoldings.size());

        // Multi-Asset Portfolio Historical Time Series and Drawdown / Volatility
        List<HistoricalRiskPointDto> riskSeries = buildHistoricalRiskSeries(analyzedHoldings, candleMap);

        BigDecimal portfolioVol = BigDecimal.ZERO;
        BigDecimal portfolioMaxDrawdown = BigDecimal.ZERO;

        if (riskSeries.size() >= 2) {
            List<Double> portfolioReturns = new ArrayList<>();
            for (int i = 1; i < riskSeries.size(); i++) {
                double prevVal = riskSeries.get(i - 1).portfolioValueIndex().doubleValue();
                double currVal = riskSeries.get(i).portfolioValueIndex().doubleValue();
                if (prevVal > 0) {
                    portfolioReturns.add((currVal - prevVal) / prevVal);
                }
            }

            if (!portfolioReturns.isEmpty()) {
                double dailyStd = calculateStandardDeviation(portfolioReturns);
                double annualizedVol = dailyStd * SQRT_252 * 100.0;
                portfolioVol = BigDecimal.valueOf(annualizedVol).setScale(2, RoundingMode.HALF_UP);
            }

            // Max Drawdown over the calculated series
            double maxDd = 0.0;
            for (HistoricalRiskPointDto pt : riskSeries) {
                if (pt.drawdownPercent() != null) {
                    maxDd = Math.max(maxDd, pt.drawdownPercent().doubleValue());
                }
            }
            portfolioMaxDrawdown = BigDecimal.valueOf(maxDd).setScale(2, RoundingMode.HALF_UP);
        } else {
            // Weighted average holding volatility fallback if time series alignment has < 2 points
            BigDecimal weightedVol = BigDecimal.ZERO;
            for (HoldingAnalysis a : analyzedHoldings) {
                if (a.annualizedVol != null) {
                    weightedVol = weightedVol.add(a.annualizedVol.multiply(a.weight));
                }
            }
            portfolioVol = weightedVol.setScale(2, RoundingMode.HALF_UP);
        }

        // Value at Risk (VaR 95% 1-Day)
        double dailyStd = portfolioVol.doubleValue() / (SQRT_252 * 100.0);
        double var95Pct = Z_95 * dailyStd * 100.0;
        BigDecimal var95DailyPercent = BigDecimal.valueOf(var95Pct).setScale(2, RoundingMode.HALF_UP);
        BigDecimal var95DailyAmount = equityMarketValue.multiply(BigDecimal.valueOf(Z_95 * dailyStd))
                .setScale(2, RoundingMode.HALF_UP);

        RiskExposureDto exposure = new RiskExposureDto(
                totalInvested,
                equityMarketValue,
                cashBalance,
                totalPortfolioValue,
                equityAllocationPercent,
                cashAllocationPercent,
                var95DailyAmount,
                var95DailyPercent
        );

        // Portfolio Beta vs Real Benchmark (e.g. NIFTY 50 or SPY)
        BenchmarkResult benchmarkResult = calculatePortfolioBeta(analyzedHoldings, riskSeries);

        List<HoldingRiskDto> holdingDtos = analyzedHoldings.stream()
                .map(a -> new HoldingRiskDto(
                        a.holding.holdingId(),
                        a.holding.symbol(),
                        a.holding.companyName(),
                        a.holding.exchange(),
                        a.holding.currency(),
                        a.holding.quantity(),
                        a.holding.currentPrice(),
                        a.holding.currentValue(),
                        a.weightPercent,
                        a.annualizedVol,
                        a.maxDrawdown,
                        a.var95Daily,
                        a.holding.unrealizedPnL(),
                        a.holding.unrealizedPnLPercent(),
                        a.riskRating,
                        a.dataAvailable
                ))
                .collect(Collectors.toList());

        boolean hasSufficientData = !riskSeries.isEmpty() || analyzedHoldings.stream().anyMatch(a -> a.dataAvailable);
        String statusMessage = hasSufficientData
                ? "Risk metrics calculated successfully from live holdings and real market data."
                : "Insufficient historical market data available for some holdings.";

        return new PortfolioRiskDto(
                exposure,
                portfolioVol,
                portfolioMaxDrawdown,
                hhi,
                top1Weight,
                top3Weight,
                effectiveN,
                diversificationRating,
                benchmarkResult.beta,
                benchmarkResult.symbol,
                benchmarkResult.available,
                holdingDtos,
                riskSeries,
                System.currentTimeMillis(),
                "Real Portfolio Holdings & Live Historical Market Data",
                false,
                hasSufficientData,
                statusMessage
        );
    }

    private List<CandleDto> fetchCandlesSafely(String symbol) {
        if (symbol == null || symbol.trim().isEmpty()) {
            return Collections.emptyList();
        }
        try {
            CandleSeriesDto series = marketDataService.getCandles(symbol.trim(), "1day", 100);
            if (series != null && series.getCandles() != null) {
                return series.getCandles();
            }
        } catch (Exception e) {
            log.warn("Unable to fetch daily candles for {}: {}", symbol, e.getMessage());
        }
        return Collections.emptyList();
    }

    private HoldingAnalysis analyzeHolding(UserHoldingDto holding, BigDecimal weight, List<CandleDto> candles) {
        BigDecimal weightPercent = weight.multiply(BigDecimal.valueOf(100)).setScale(2, RoundingMode.HALF_UP);

        if (candles == null || candles.size() < 2) {
            return new HoldingAnalysis(
                    holding, weight, weightPercent, null, null, null, "Moderate Risk", false
            );
        }

        List<Double> returns = new ArrayList<>();
        double peak = Double.NEGATIVE_INFINITY;
        double maxDd = 0.0;

        for (int i = 0; i < candles.size(); i++) {
            CandleDto c = candles.get(i);
            double close = c.getClose() != null ? c.getClose().doubleValue() : 0.0;
            if (close <= 0) continue;

            if (close > peak) {
                peak = close;
            } else if (peak > 0) {
                double dd = (peak - close) / peak * 100.0;
                if (dd > maxDd) {
                    maxDd = dd;
                }
            }

            if (i > 0) {
                double prevClose = candles.get(i - 1).getClose() != null ? candles.get(i - 1).getClose().doubleValue() : 0.0;
                if (prevClose > 0) {
                    returns.add((close - prevClose) / prevClose);
                }
            }
        }

        if (returns.isEmpty()) {
            return new HoldingAnalysis(
                    holding, weight, weightPercent, null, null, null, "Moderate Risk", false
            );
        }

        double dailyStd = calculateStandardDeviation(returns);
        double annualizedVol = dailyStd * SQRT_252 * 100.0;
        BigDecimal volBd = BigDecimal.valueOf(annualizedVol).setScale(2, RoundingMode.HALF_UP);
        BigDecimal maxDdBd = BigDecimal.valueOf(maxDd).setScale(2, RoundingMode.HALF_UP);

        double holdingVal = holding.currentValue() != null ? holding.currentValue().doubleValue() : 0.0;
        double var95 = Z_95 * dailyStd * holdingVal;
        BigDecimal var95Bd = BigDecimal.valueOf(var95).setScale(2, RoundingMode.HALF_UP);

        String rating;
        if (annualizedVol < 20.0) {
            rating = "Low Risk";
        } else if (annualizedVol <= 40.0) {
            rating = "Moderate Risk";
        } else {
            rating = "High Risk";
        }

        return new HoldingAnalysis(
                holding, weight, weightPercent, volBd, maxDdBd, var95Bd, rating, true
        );
    }

    private List<HistoricalRiskPointDto> buildHistoricalRiskSeries(
            List<HoldingAnalysis> holdings,
            Map<String, List<CandleDto>> candleMap
    ) {
        // Collect all distinct dates present across active holdings
        Map<String, Map<String, Double>> dateSymbolPrices = new TreeMap<>(); // Sorted ascending by date
        Map<String, Long> dateTimestamps = new HashMap<>();

        for (HoldingAnalysis a : holdings) {
            String sym = a.holding.symbol();
            List<CandleDto> candles = candleMap.get(sym);
            if (candles != null) {
                for (CandleDto c : candles) {
                    if (c.getDatetime() != null && c.getClose() != null && c.getClose().compareTo(BigDecimal.ZERO) > 0) {
                        String dateKey = c.getDatetime().length() >= 10 ? c.getDatetime().substring(0, 10) : c.getDatetime();
                        dateSymbolPrices.computeIfAbsent(dateKey, k -> new HashMap<>())
                                .put(sym, c.getClose().doubleValue());
                        if (c.getTimestamp() != null) {
                            dateTimestamps.put(dateKey, c.getTimestamp());
                        }
                    }
                }
            }
        }

        if (dateSymbolPrices.size() < 2) {
            return Collections.emptyList();
        }

        // Determine baseline price (first available price) for each symbol to compute relative performance
        Map<String, Double> basePrices = new HashMap<>();
        for (HoldingAnalysis a : holdings) {
            String sym = a.holding.symbol();
            for (Map<String, Double> prices : dateSymbolPrices.values()) {
                if (prices.containsKey(sym) && prices.get(sym) > 0) {
                    basePrices.put(sym, prices.get(sym));
                    break;
                }
            }
        }

        List<HistoricalRiskPointDto> series = new ArrayList<>();
        double peakIndex = Double.NEGATIVE_INFINITY;
        List<Double> rollingDailyReturns = new ArrayList<>();

        double prevDayValueIndex = -1.0;

        for (Map.Entry<String, Map<String, Double>> entry : dateSymbolPrices.entrySet()) {
            String date = entry.getKey();
            Map<String, Double> prices = entry.getValue();

            double weightedIndex = 0.0;
            double coveredWeight = 0.0;

            for (HoldingAnalysis a : holdings) {
                String sym = a.holding.symbol();
                Double baseP = basePrices.get(sym);
                Double currentP = prices.get(sym);

                if (baseP != null && baseP > 0 && currentP != null && currentP > 0) {
                    double assetIndex = (currentP / baseP) * 100.0;
                    weightedIndex += assetIndex * a.weight.doubleValue();
                    coveredWeight += a.weight.doubleValue();
                }
            }

            if (coveredWeight > 0) {
                double portfolioValIndex = (weightedIndex / coveredWeight);
                if (portfolioValIndex > peakIndex) {
                    peakIndex = portfolioValIndex;
                }

                double dd = peakIndex > 0 ? ((peakIndex - portfolioValIndex) / peakIndex) * 100.0 : 0.0;

                if (prevDayValueIndex > 0) {
                    rollingDailyReturns.add((portfolioValIndex - prevDayValueIndex) / prevDayValueIndex);
                }
                prevDayValueIndex = portfolioValIndex;

                BigDecimal rollingVol = BigDecimal.ZERO;
                if (rollingDailyReturns.size() >= 3) {
                    // 15-day rolling window or available window
                    int windowStart = Math.max(0, rollingDailyReturns.size() - 15);
                    List<Double> window = rollingDailyReturns.subList(windowStart, rollingDailyReturns.size());
                    double std = calculateStandardDeviation(window);
                    rollingVol = BigDecimal.valueOf(std * SQRT_252 * 100.0).setScale(2, RoundingMode.HALF_UP);
                }

                Long ts = dateTimestamps.getOrDefault(date, System.currentTimeMillis() / 1000);

                series.add(new HistoricalRiskPointDto(
                        ts,
                        date,
                        BigDecimal.valueOf(portfolioValIndex).setScale(2, RoundingMode.HALF_UP),
                        BigDecimal.valueOf(dd).setScale(2, RoundingMode.HALF_UP),
                        rollingVol
                ));
            }
        }

        return series;
    }

    private BenchmarkResult calculatePortfolioBeta(
            List<HoldingAnalysis> holdings,
            List<HistoricalRiskPointDto> riskSeries
    ) {
        if (riskSeries == null || riskSeries.size() < 5) {
            return new BenchmarkResult(null, "Data unavailable", false);
        }

        // Determine likely benchmark based on exchange
        boolean isIndian = holdings.stream().anyMatch(h ->
                "NSE".equalsIgnoreCase(h.holding.exchange()) ||
                "BSE".equalsIgnoreCase(h.holding.exchange()) ||
                (h.holding.currency() != null && "INR".equalsIgnoreCase(h.holding.currency()))
        );

        String benchmarkSymbol = isIndian ? "NIFTY 50" : "SPY";

        List<CandleDto> benchmarkCandles = Collections.emptyList();
        try {
            benchmarkCandles = fetchCandlesSafely(benchmarkSymbol);
            if (benchmarkCandles.isEmpty() && isIndian) {
                benchmarkCandles = fetchCandlesSafely("NSE_INDEX|Nifty 50");
            }
        } catch (Exception e) {
            log.info("Benchmark candle fetch skipped: {}", e.getMessage());
        }

        if (benchmarkCandles.size() < 5) {
            return new BenchmarkResult(null, benchmarkSymbol, false);
        }

        Map<String, Double> benchPrices = new HashMap<>();
        for (CandleDto c : benchmarkCandles) {
            if (c.getDatetime() != null && c.getClose() != null) {
                String dateKey = c.getDatetime().length() >= 10 ? c.getDatetime().substring(0, 10) : c.getDatetime();
                benchPrices.put(dateKey, c.getClose().doubleValue());
            }
        }

        List<Double> portfolioReturns = new ArrayList<>();
        List<Double> benchmarkReturns = new ArrayList<>();

        for (int i = 1; i < riskSeries.size(); i++) {
            String prevDate = riskSeries.get(i - 1).date();
            String currDate = riskSeries.get(i).date();

            Double pBenchPrev = benchPrices.get(prevDate);
            Double pBenchCurr = benchPrices.get(currDate);

            if (pBenchPrev != null && pBenchCurr != null && pBenchPrev > 0) {
                double rBench = (pBenchCurr - pBenchPrev) / pBenchPrev;
                double pPortPrev = riskSeries.get(i - 1).portfolioValueIndex().doubleValue();
                double pPortCurr = riskSeries.get(i).portfolioValueIndex().doubleValue();

                if (pPortPrev > 0) {
                    double rPort = (pPortCurr - pPortPrev) / pPortPrev;
                    portfolioReturns.add(rPort);
                    benchmarkReturns.add(rBench);
                }
            }
        }

        if (portfolioReturns.size() < 5) {
            return new BenchmarkResult(null, benchmarkSymbol, false);
        }

        double cov = calculateCovariance(portfolioReturns, benchmarkReturns);
        double varBench = calculateVariance(benchmarkReturns);

        if (varBench <= 1e-9) {
            return new BenchmarkResult(null, benchmarkSymbol, false);
        }

        double beta = cov / varBench;
        BigDecimal betaBd = BigDecimal.valueOf(beta).setScale(2, RoundingMode.HALF_UP);

        return new BenchmarkResult(betaBd, benchmarkSymbol, true);
    }

    private double calculateStandardDeviation(List<Double> values) {
        if (values == null || values.size() < 2) return 0.0;
        double variance = calculateVariance(values);
        return Math.sqrt(variance);
    }

    private double calculateVariance(List<Double> values) {
        if (values == null || values.size() < 2) return 0.0;
        double mean = values.stream().mapToDouble(Double::doubleValue).average().orElse(0.0);
        double sumSq = 0.0;
        for (double v : values) {
            double diff = v - mean;
            sumSq += diff * diff;
        }
        return sumSq / (values.size() - 1);
    }

    private double calculateCovariance(List<Double> x, List<Double> y) {
        if (x.size() != y.size() || x.size() < 2) return 0.0;
        double meanX = x.stream().mapToDouble(Double::doubleValue).average().orElse(0.0);
        double meanY = y.stream().mapToDouble(Double::doubleValue).average().orElse(0.0);
        double sumProd = 0.0;
        for (int i = 0; i < x.size(); i++) {
            sumProd += (x.get(i) - meanX) * (y.get(i) - meanY);
        }
        return sumProd / (x.size() - 1);
    }

    private String classifyDiversification(BigDecimal hhi, int assetCount) {
        if (assetCount <= 1) {
            return "Single Asset (Undiversified)";
        }
        if (hhi.compareTo(BigDecimal.valueOf(1500)) < 0) {
            return "Well Diversified";
        } else if (hhi.compareTo(BigDecimal.valueOf(2500)) <= 0) {
            return "Moderately Concentrated";
        } else {
            return "Highly Concentrated";
        }
    }

    private static class HoldingAnalysis {
        final UserHoldingDto holding;
        final BigDecimal weight;
        final BigDecimal weightPercent;
        final BigDecimal annualizedVol;
        final BigDecimal maxDrawdown;
        final BigDecimal var95Daily;
        final String riskRating;
        final boolean dataAvailable;

        HoldingAnalysis(
                UserHoldingDto holding, BigDecimal weight, BigDecimal weightPercent,
                BigDecimal annualizedVol, BigDecimal maxDrawdown, BigDecimal var95Daily,
                String riskRating, boolean dataAvailable
        ) {
            this.holding = holding;
            this.weight = weight;
            this.weightPercent = weightPercent;
            this.annualizedVol = annualizedVol;
            this.maxDrawdown = maxDrawdown;
            this.var95Daily = var95Daily;
            this.riskRating = riskRating;
            this.dataAvailable = dataAvailable;
        }
    }

    private static class BenchmarkResult {
        final BigDecimal beta;
        final String symbol;
        final boolean available;

        BenchmarkResult(BigDecimal beta, String symbol, boolean available) {
            this.beta = beta;
            this.symbol = symbol;
            this.available = available;
        }
    }
}
