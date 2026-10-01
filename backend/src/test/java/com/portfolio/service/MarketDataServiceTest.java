package com.portfolio.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.portfolio.dto.market.CandleSeriesDto;
import com.portfolio.dto.market.FundamentalDataDto;
import com.portfolio.dto.market.MarketPriceDto;
import com.portfolio.dto.market.StockQuoteDto;
import com.portfolio.dto.market.StockSearchResponseDto;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class MarketDataServiceTest {

    private RestTemplate restTemplate;
    private MockRestServiceServer mockServer;
    private MarketDataService marketDataService;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        restTemplate = new RestTemplate();
        mockServer = MockRestServiceServer.createServer(restTemplate);
        objectMapper = new ObjectMapper();
        marketDataService = new MarketDataService(restTemplate, objectMapper);
        ReflectionTestUtils.setField(marketDataService, "apiKey", "test-api-key");
        ReflectionTestUtils.setField(marketDataService, "baseUrl", "https://api.twelvedata.com");
    }

    @Test
    @DisplayName("1. Successfully parse Twelve Data Forex quote")
    void testGetForexPriceSuccess() {
        String jsonResponse = """
                {
                    "symbol": "EUR/USD",
                    "name": "Euro / US Dollar",
                    "exchange": "Forex",
                    "currency": "USD",
                    "datetime": "2026-09-30",
                    "timestamp": 1727690000,
                    "open": "1.08500",
                    "high": "1.08900",
                    "low": "1.08200",
                    "close": "1.08650",
                    "previous_close": "1.08450",
                    "change": "0.00200",
                    "percent_change": "0.18442"
                }
                """;

        mockServer.expect(requestTo(containsString("/quote?symbol=EUR/USD")))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess(jsonResponse, MediaType.APPLICATION_JSON));

        MarketPriceDto forex = marketDataService.getForexPrice("EUR/USD");

        mockServer.verify();
        assertThat(forex).isNotNull();
        assertThat(forex.symbol()).isEqualTo("EUR/USD");
        assertThat(forex.price()).isEqualByComparingTo(new BigDecimal("1.08650"));
        assertThat(forex.change()).isEqualByComparingTo(new BigDecimal("0.00200"));
        assertThat(forex.changePercent()).isEqualTo("+0.18%");
        assertThat(forex.timestamp()).isEqualTo(1727690000L);
    }

    @Test
    @DisplayName("2. Successfully parse Twelve Data Crypto quote")
    void testGetCryptoPriceSuccess() {
        String jsonResponse = """
                {
                    "symbol": "BTC/USD",
                    "name": "Bitcoin / US Dollar",
                    "exchange": "Coinbase Pro",
                    "currency_base": "Bitcoin",
                    "currency_quote": "US Dollar",
                    "datetime": "2026-09-30",
                    "timestamp": 1727690000,
                    "open": "64500.00",
                    "high": "65200.00",
                    "low": "63900.00",
                    "close": "64850.00",
                    "previous_close": "64200.00",
                    "change": "650.00",
                    "percent_change": "1.01246"
                }
                """;

        mockServer.expect(requestTo(containsString("/quote?symbol=BTC/USD")))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess(jsonResponse, MediaType.APPLICATION_JSON));

        MarketPriceDto crypto = marketDataService.getCryptoPrice("BTC/USD");

        mockServer.verify();
        assertThat(crypto).isNotNull();
        assertThat(crypto.symbol()).isEqualTo("BTC/USD");
        assertThat(crypto.price()).isEqualByComparingTo(new BigDecimal("64850.00"));
        assertThat(crypto.change()).isEqualByComparingTo(new BigDecimal("650.00"));
        assertThat(crypto.changePercent()).isEqualTo("+1.01%");
        assertThat(crypto.timestamp()).isEqualTo(1727690000L);
    }

    @Test
    @DisplayName("3. Successfully parse Twelve Data Stock quote response")
    void testGetQuoteSuccess() {
        String jsonResponse = """
                {
                    "symbol": "AAPL",
                    "name": "Apple Inc",
                    "exchange": "NASDAQ",
                    "currency": "USD",
                    "datetime": "2026-09-30",
                    "timestamp": 1727690000,
                    "open": "227.00000",
                    "high": "229.50000",
                    "low": "226.00000",
                    "close": "228.50000",
                    "volume": "45000000",
                    "previous_close": "226.70000",
                    "change": "1.80000",
                    "percent_change": "0.79400"
                }
                """;

        mockServer.expect(requestTo(containsString("/quote?symbol=AAPL")))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess(jsonResponse, MediaType.APPLICATION_JSON));

        StockQuoteDto quote = marketDataService.getQuote("AAPL");

        mockServer.verify();
        assertThat(quote).isNotNull();
        assertThat(quote.symbol()).isEqualTo("AAPL");
        assertThat(quote.name()).isEqualTo("Apple Inc");
        assertThat(quote.price()).isEqualByComparingTo(new BigDecimal("228.50000"));
        assertThat(quote.open()).isEqualByComparingTo(new BigDecimal("227.00000"));
        assertThat(quote.high()).isEqualByComparingTo(new BigDecimal("229.50000"));
        assertThat(quote.low()).isEqualByComparingTo(new BigDecimal("226.00000"));
        assertThat(quote.previousClose()).isEqualByComparingTo(new BigDecimal("226.70000"));
        assertThat(quote.change()).isEqualByComparingTo(new BigDecimal("1.80000"));
        assertThat(quote.changePercent()).isEqualTo("+0.79%");
        assertThat(quote.volume()).isEqualTo(45000000L);
        assertThat(quote.latestTradingDay()).isEqualTo("2026-09-30");
        assertThat(quote.timestamp()).isEqualTo(1727690000L);
    }

    @Test
    @DisplayName("4. Successfully parse Twelve Data Candles time series")
    void testGetCandlesSuccess() {
        String jsonResponse = """
                {
                    "meta": {
                        "symbol": "AAPL",
                        "interval": "5min",
                        "currency": "USD",
                        "exchange": "NASDAQ",
                        "type": "Common Stock"
                    },
                    "values": [
                        {
                            "datetime": "2026-09-29 15:55:00",
                            "open": "228.00",
                            "high": "229.00",
                            "low": "227.50",
                            "close": "228.50",
                            "volume": "100000"
                        },
                        {
                            "datetime": "2026-09-29 15:50:00",
                            "open": "227.00",
                            "high": "228.20",
                            "low": "226.80",
                            "close": "228.00",
                            "volume": "80000"
                        }
                    ],
                    "status": "ok"
                }
                """;

        mockServer.expect(requestTo(containsString("/time_series?symbol=AAPL&interval=5min&outputsize=60")))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess(jsonResponse, MediaType.APPLICATION_JSON));

        CandleSeriesDto result = marketDataService.getCandles("AAPL", "5min", 60);

        mockServer.verify();
        assertThat(result).isNotNull();
        assertThat(result.getSymbol()).isEqualTo("AAPL");
        assertThat(result.getInterval()).isEqualTo("5min");
        assertThat(result.getCandles()).hasSize(2);
        // Chronologically reversed (ascending: 15:50 first, then 15:55)
        assertThat(result.getCandles().get(0).getDatetime()).isEqualTo("2026-09-29 15:50:00");
        assertThat(result.getCandles().get(1).getDatetime()).isEqualTo("2026-09-29 15:55:00");
    }

    @Test
    @DisplayName("5. Throw 429 when Twelve Data returns rate limit error")
    void testRateLimitHandling() {
        String jsonResponse = """
                {
                    "code": 429,
                    "message": "You have reached your API limit. Please upgrade your plan.",
                    "status": "error"
                }
                """;

        mockServer.expect(requestTo(containsString("/quote?symbol=IBM")))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess(jsonResponse, MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> marketDataService.getQuote("IBM"))
                .isInstanceOf(ResponseStatusException.class)
                .matches(e -> ((ResponseStatusException) e).getStatusCode() == HttpStatus.TOO_MANY_REQUESTS);

        mockServer.verify();
    }

    @Test
    @DisplayName("6. Throw 404 when symbol is not found")
    void testSymbolNotFound() {
        String jsonResponse = """
                {
                    "code": 404,
                    "message": "Cannot be found: symbol UNKNOWN not found",
                    "status": "error"
                }
                """;

        mockServer.expect(requestTo(containsString("/quote?symbol=UNKNOWN")))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess(jsonResponse, MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> marketDataService.getQuote("UNKNOWN"))
                .isInstanceOf(ResponseStatusException.class)
                .matches(e -> ((ResponseStatusException) e).getStatusCode() == HttpStatus.NOT_FOUND);

        mockServer.verify();
    }

    @Test
    @DisplayName("7. Successfully parse Twelve Data Symbol Search response")
    void testSearchSymbolsSuccess() {
        String jsonResponse = """
                {
                    "data": [
                        {
                            "symbol": "BTC/USD",
                            "instrument_name": "Bitcoin / US Dollar",
                            "exchange": "Coinbase Pro",
                            "country": "",
                            "type": "Digital Currency",
                            "currency": "USD"
                        }
                    ],
                    "status": "ok"
                }
                """;

        mockServer.expect(requestTo(containsString("/symbol_search?symbol=Bitcoin")))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess(jsonResponse, MediaType.APPLICATION_JSON));

        StockSearchResponseDto result = marketDataService.searchSymbols("Bitcoin");

        mockServer.verify();
        assertThat(result).isNotNull();
        assertThat(result.bestMatches()).hasSize(1);
        assertThat(result.bestMatches().get(0).symbol()).isEqualTo("BTC/USD");
        assertThat(result.bestMatches().get(0).name()).isEqualTo("Bitcoin / US Dollar");
    }

    @Test
    @DisplayName("8. Successfully parse Twelve Data company profile and statistics for Fundamentals")
    void testGetFundamentalsTwelveDataSuccess() {
        String profileJson = """
                {
                    "symbol": "AAPL",
                    "name": "Apple Inc",
                    "exchange": "NASDAQ",
                    "sector": "Technology",
                    "industry": "Consumer Electronics",
                    "CEO": "Mr. Tim Cook",
                    "website": "https://www.apple.com",
                    "description": "Apple Inc. designs, manufactures, and markets smartphones, personal computers, tablets, wearables, and accessories."
                }
                """;

        String statsJson = """
                {
                    "meta": {
                        "symbol": "AAPL",
                        "name": "Apple Inc.",
                        "currency": "USD",
                        "exchange": "NASDAQ"
                    },
                    "statistics": {
                        "valuations_metrics": {
                            "market_capitalization": 3000000000000,
                            "trailing_pe": 30.5
                        },
                        "financials": {
                            "return_on_equity_ttm": 1.45,
                            "income_statement": {
                                "diluted_eps_ttm": 6.42,
                                "revenue_ttm": 383285000000,
                                "net_income_to_common_ttm": 96995000000
                            }
                        },
                        "dividends_and_splits": {
                            "trailing_annual_dividend_yield": 0.0055
                        },
                        "stock_price_summary": {
                            "fifty_two_week_high": 237.23,
                            "fifty_two_week_low": 164.08
                        }
                    }
                }
                """;

        mockServer.expect(requestTo(containsString("/profile?symbol=AAPL")))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess(profileJson, MediaType.APPLICATION_JSON));

        mockServer.expect(requestTo(containsString("/statistics?symbol=AAPL")))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess(statsJson, MediaType.APPLICATION_JSON));

        FundamentalDataDto data = marketDataService.getFundamentals("AAPL");

        mockServer.verify();
        assertThat(data).isNotNull();
        assertThat(data.symbol()).isEqualTo("AAPL");
        assertThat(data.companyName()).isEqualTo("Apple Inc");
        assertThat(data.exchange()).isEqualTo("NASDAQ");
        assertThat(data.currency()).isEqualTo("USD");
        assertThat(data.provider()).isEqualTo("Twelve Data");
        assertThat(data.sector()).isEqualTo("Technology");
        assertThat(data.industry()).isEqualTo("Consumer Electronics");
        assertThat(data.marketCap()).isEqualByComparingTo(new BigDecimal("3000000000000"));
        assertThat(data.peRatio()).isEqualByComparingTo(new BigDecimal("30.5"));
        assertThat(data.eps()).isEqualByComparingTo(new BigDecimal("6.42"));
        assertThat(data.roe()).isEqualByComparingTo(new BigDecimal("1.45"));
        assertThat(data.revenue()).isEqualByComparingTo(new BigDecimal("383285000000"));
        assertThat(data.netIncome()).isEqualByComparingTo(new BigDecimal("96995000000"));
        assertThat(data.dividendYield()).isEqualByComparingTo(new BigDecimal("0.0055"));
        assertThat(data.fiftyTwoWeekHigh()).isEqualByComparingTo(new BigDecimal("237.23"));
        assertThat(data.fiftyTwoWeekLow()).isEqualByComparingTo(new BigDecimal("164.08"));
    }
}
