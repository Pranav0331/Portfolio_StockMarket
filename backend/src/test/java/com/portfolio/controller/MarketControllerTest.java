package com.portfolio.controller;

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
    @DisplayName("1. GET /api/market/quote with valid symbol returns HTTP 200 and quote data")
    void testGetQuoteSuccess() throws Exception {
        StockQuoteDto mockQuote = new StockQuoteDto(
                "RELIANCE.BSE",
                null,
                new BigDecimal("2980.50"),
                new BigDecimal("15.20"),
                "+0.51%",
                new BigDecimal("2965.30"),
                new BigDecimal("2970.00"),
                new BigDecimal("2995.00"),
                new BigDecimal("2960.00"),
                1250000L,
                "2026-09-28"
        );

        when(marketDataService.getQuote(eq("RELIANCE.BSE"))).thenReturn(mockQuote);

        mockMvc.perform(get("/api/market/quote")
                        .param("symbol", "RELIANCE.BSE")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.symbol").value("RELIANCE.BSE"))
                .andExpect(jsonPath("$.price").value(2980.50))
                .andExpect(jsonPath("$.change").value(15.20))
                .andExpect(jsonPath("$.changePercent").value("+0.51%"))
                .andExpect(jsonPath("$.volume").value(1250000));
    }

    @Test
    @DisplayName("2. GET /api/market/quote with invalid symbol returns HTTP 404")
    void testGetQuoteNotFound() throws Exception {
        when(marketDataService.getQuote(eq("INVALIDXYZ")))
                .thenThrow(new ResponseStatusException(HttpStatus.NOT_FOUND, "No market quote found for symbol: INVALIDXYZ"));

        mockMvc.perform(get("/api/market/quote")
                        .param("symbol", "INVALIDXYZ"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404));
    }

    @Test
    @DisplayName("3. GET /api/market/quote with rate limit returns HTTP 429")
    void testGetQuoteRateLimit() throws Exception {
        when(marketDataService.getQuote(eq("IBM")))
                .thenThrow(new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Alpha Vantage market data rate limit reached. Please try again shortly."));

        mockMvc.perform(get("/api/market/quote")
                        .param("symbol", "IBM"))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.status").value(429));
    }

    @Test
    @DisplayName("4. GET /api/market/search with keywords returns matches and HTTP 200")
    void testSearchSymbolsSuccess() throws Exception {
        StockSearchItemDto item = new StockSearchItemDto(
                "RELIANCE.BSE",
                "Reliance Industries Limited",
                "Equity",
                "India/Bombay",
                "INR",
                "0.9231"
        );
        StockSearchResponseDto mockResponse = new StockSearchResponseDto(List.of(item), "Reliance");

        when(marketDataService.searchSymbols(eq("Reliance"))).thenReturn(mockResponse);

        mockMvc.perform(get("/api/market/search")
                        .param("keywords", "Reliance")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.query").value("Reliance"))
                .andExpect(jsonPath("$.bestMatches[0].symbol").value("RELIANCE.BSE"))
                .andExpect(jsonPath("$.bestMatches[0].name").value("Reliance Industries Limited"));
    }
}
