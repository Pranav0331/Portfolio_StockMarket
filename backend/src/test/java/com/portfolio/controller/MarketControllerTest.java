package com.portfolio.controller;

import com.portfolio.dto.market.MarketPriceDto;
import com.portfolio.dto.market.StockQuoteDto;
import com.portfolio.dto.market.StockSearchItemDto;
import com.portfolio.dto.market.StockSearchResponseDto;
import com.portfolio.service.MarketDataService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.List;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class MarketControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private MarketDataService marketDataService;

    @Test
    @DisplayName("1. GET /api/market/forex returns HTTP 200 and forex price data")
    void testGetForexPriceSuccess() throws Exception {
        MarketPriceDto mockForex = new MarketPriceDto(
                "EUR/USD",
                new BigDecimal("1.0850"),
                new BigDecimal("0.0020"),
                "+0.18%",
                1727690000L
        );

        when(marketDataService.getForexPrice(eq("EUR/USD"))).thenReturn(mockForex);

        mockMvc.perform(get("/api/market/forex")
                        .param("symbol", "EUR/USD")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.symbol").value("EUR/USD"))
                .andExpect(jsonPath("$.price").value(1.0850))
                .andExpect(jsonPath("$.change").value(0.0020))
                .andExpect(jsonPath("$.changePercent").value("+0.18%"))
                .andExpect(jsonPath("$.timestamp").value(1727690000));
    }

    @Test
    @DisplayName("2. GET /api/market/crypto returns HTTP 200 and crypto price data")
    void testGetCryptoPriceSuccess() throws Exception {
        MarketPriceDto mockCrypto = new MarketPriceDto(
                "BTC/USD",
                new BigDecimal("64850.00"),
                new BigDecimal("650.00"),
                "+1.01%",
                1727690000L
        );

        when(marketDataService.getCryptoPrice(eq("BTC/USD"))).thenReturn(mockCrypto);

        mockMvc.perform(get("/api/market/crypto")
                        .param("symbol", "BTC/USD")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.symbol").value("BTC/USD"))
                .andExpect(jsonPath("$.price").value(64850.00))
                .andExpect(jsonPath("$.change").value(650.00))
                .andExpect(jsonPath("$.changePercent").value("+1.01%"))
                .andExpect(jsonPath("$.timestamp").value(1727690000));
    }

    @Test
    @DisplayName("3. GET /api/market/quote with valid symbol returns HTTP 200 and quote data")
    void testGetQuoteSuccess() throws Exception {
        StockQuoteDto mockQuote = new StockQuoteDto(
                "AAPL",
                "Apple Inc",
                new BigDecimal("228.50"),
                new BigDecimal("1.80"),
                "+0.79%",
                new BigDecimal("226.70"),
                new BigDecimal("227.00"),
                new BigDecimal("229.50"),
                new BigDecimal("226.00"),
                45000000L,
                "2026-09-28",
                1727690000L
        );

        when(marketDataService.getQuote(eq("AAPL"))).thenReturn(mockQuote);

        mockMvc.perform(get("/api/market/quote")
                        .param("symbol", "AAPL")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.symbol").value("AAPL"))
                .andExpect(jsonPath("$.price").value(228.50))
                .andExpect(jsonPath("$.change").value(1.80))
                .andExpect(jsonPath("$.changePercent").value("+0.79%"));
    }

    @Test
    @DisplayName("4. GET /api/market/quote with invalid symbol returns HTTP 404")
    void testGetQuoteNotFound() throws Exception {
        when(marketDataService.getQuote(eq("INVALIDXYZ")))
                .thenThrow(new ResponseStatusException(HttpStatus.NOT_FOUND, "No market quote found for symbol: INVALIDXYZ"));

        mockMvc.perform(get("/api/market/quote")
                        .param("symbol", "INVALIDXYZ"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404));
    }

    @Test
    @DisplayName("5. GET /api/market/quote with rate limit returns HTTP 429")
    void testGetQuoteRateLimit() throws Exception {
        when(marketDataService.getQuote(eq("IBM")))
                .thenThrow(new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Twelve Data API rate limit reached. Please try again shortly."));

        mockMvc.perform(get("/api/market/quote")
                        .param("symbol", "IBM"))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.status").value(429));
    }

    @Test
    @DisplayName("6. GET /api/market/search with keywords returns matches and HTTP 200")
    void testSearchSymbolsSuccess() throws Exception {
        StockSearchItemDto item = new StockSearchItemDto(
                "BTC/USD",
                "Bitcoin / US Dollar",
                "Digital Currency",
                "",
                "USD",
                null
        );
        StockSearchResponseDto mockResponse = new StockSearchResponseDto(List.of(item), "Bitcoin");

        when(marketDataService.searchSymbols(eq("Bitcoin"))).thenReturn(mockResponse);

        mockMvc.perform(get("/api/market/search")
                        .param("keywords", "Bitcoin")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.query").value("Bitcoin"))
                .andExpect(jsonPath("$.bestMatches[0].symbol").value("BTC/USD"))
                .andExpect(jsonPath("$.bestMatches[0].name").value("Bitcoin / US Dollar"));
    }
}
