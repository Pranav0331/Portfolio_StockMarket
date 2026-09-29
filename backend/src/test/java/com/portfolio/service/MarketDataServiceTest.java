package com.portfolio.service;

import com.fasterxml.jackson.databind.ObjectMapper;
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
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;
import static org.hamcrest.Matchers.containsString;

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
        ReflectionTestUtils.setField(marketDataService, "baseUrl", "https://www.alphavantage.co");
    }

    @Test
    @DisplayName("1. Successfully parse Alpha Vantage Global Quote response")
    void testGetQuoteSuccess() {
        String jsonResponse = """
                {
                    "Global Quote": {
                        "01. symbol": "IBM",
                        "02. open": "119.3700",
                        "03. high": "120.5000",
                        "04. low": "118.8000",
                        "05. price": "119.8500",
                        "06. volume": "4468975",
                        "07. latest trading day": "2026-09-28",
                        "08. previous close": "119.5000",
                        "09. change": "0.3500",
                        "10. change percent": "0.2929%"
                    }
                }
                """;

        mockServer.expect(requestTo(containsString("function=GLOBAL_QUOTE")))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess(jsonResponse, MediaType.APPLICATION_JSON));

        StockQuoteDto quote = marketDataService.getQuote("IBM");

        mockServer.verify();
        assertThat(quote).isNotNull();
        assertThat(quote.symbol()).isEqualTo("IBM");
        assertThat(quote.price()).isEqualByComparingTo(new BigDecimal("119.8500"));
        assertThat(quote.open()).isEqualByComparingTo(new BigDecimal("119.3700"));
        assertThat(quote.high()).isEqualByComparingTo(new BigDecimal("120.5000"));
        assertThat(quote.low()).isEqualByComparingTo(new BigDecimal("118.8000"));
        assertThat(quote.previousClose()).isEqualByComparingTo(new BigDecimal("119.5000"));
        assertThat(quote.change()).isEqualByComparingTo(new BigDecimal("0.3500"));
        assertThat(quote.changePercent()).isEqualTo("0.2929%");
        assertThat(quote.volume()).isEqualTo(4468975L);
        assertThat(quote.latestTradingDay()).isEqualTo("2026-09-28");
    }

    @Test
    @DisplayName("2. Throw 429 when Alpha Vantage returns rate limit Note")
    void testRateLimitHandling() {
        String jsonResponse = """
                {
                    "Note": "Thank you for using Alpha Vantage! Our standard API rate limit is 25 requests per day."
                }
                """;

        mockServer.expect(requestTo(containsString("function=GLOBAL_QUOTE")))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess(jsonResponse, MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> marketDataService.getQuote("IBM"))
                .isInstanceOf(ResponseStatusException.class)
                .matches(e -> ((ResponseStatusException) e).getStatusCode() == HttpStatus.TOO_MANY_REQUESTS);

        mockServer.verify();
    }

    @Test
    @DisplayName("3. Throw 404 when Global Quote object is empty")
    void testEmptyGlobalQuote() {
        String jsonResponse = """
                {
                    "Global Quote": {}
                }
                """;

        mockServer.expect(requestTo(containsString("function=GLOBAL_QUOTE")))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess(jsonResponse, MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> marketDataService.getQuote("UNKNOWN"))
                .isInstanceOf(ResponseStatusException.class)
                .matches(e -> ((ResponseStatusException) e).getStatusCode() == HttpStatus.NOT_FOUND);

        mockServer.verify();
    }

    @Test
    @DisplayName("4. Successfully parse Alpha Vantage Symbol Search response")
    void testSearchSymbolsSuccess() {
        String jsonResponse = """
                {
                    "bestMatches": [
                        {
                            "1. symbol": "RELIANCE.BSE",
                            "2. name": "Reliance Industries Limited",
                            "3. type": "Equity",
                            "4. region": "India/Bombay",
                            "5. marketOpen": "09:15",
                            "6. marketClose": "15:30",
                            "7. timezone": "UTC+5.5",
                            "8. currency": "INR",
                            "9. matchScore": "0.9091"
                        }
                    ]
                }
                """;

        mockServer.expect(requestTo(containsString("function=SYMBOL_SEARCH")))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess(jsonResponse, MediaType.APPLICATION_JSON));

        StockSearchResponseDto result = marketDataService.searchSymbols("Reliance");

        mockServer.verify();
        assertThat(result).isNotNull();
        assertThat(result.bestMatches()).hasSize(1);
        assertThat(result.bestMatches().get(0).symbol()).isEqualTo("RELIANCE.BSE");
        assertThat(result.bestMatches().get(0).name()).isEqualTo("Reliance Industries Limited");
    }
}
