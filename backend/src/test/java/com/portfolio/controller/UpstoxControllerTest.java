package com.portfolio.controller;

import com.portfolio.dto.market.CandleDto;
import com.portfolio.dto.market.CandleSeriesDto;
import com.portfolio.dto.market.StockQuoteDto;
import com.portfolio.dto.market.StockSearchItemDto;
import com.portfolio.dto.market.StockSearchResponseDto;
import com.portfolio.dto.upstox.UpstoxAuthStatusDto;
import com.portfolio.service.UpstoxService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.util.List;

import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class UpstoxControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private UpstoxService upstoxService;

    @Test
    @DisplayName("1. GET /api/upstox/auth-url returns authorization URL")
    void testGetAuthUrl() throws Exception {
        when(upstoxService.getAuthorizationUrl()).thenReturn("https://api.upstox.com/v2/login/authorization/dialog?client_id=test");

        mockMvc.perform(get("/api/upstox/auth-url"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.authUrl").value("https://api.upstox.com/v2/login/authorization/dialog?client_id=test"));
    }

    @Test
    @DisplayName("2. GET /api/upstox/login redirects to Upstox dialog")
    void testLoginRedirect() throws Exception {
        when(upstoxService.getAuthorizationUrl()).thenReturn("https://api.upstox.com/v2/login/authorization/dialog?client_id=test");

        mockMvc.perform(get("/api/upstox/login"))
                .andExpect(status().isFound())
                .andExpect(header().string("Location", "https://api.upstox.com/v2/login/authorization/dialog?client_id=test"));
    }

    @Test
    @DisplayName("3. GET /api/upstox/callback exchanges code and returns status (JSON)")
    void testCallbackSuccessJson() throws Exception {
        UpstoxAuthStatusDto status = UpstoxAuthStatusDto.connected("Rajesh Sharma", "RS1234", "trader@example.com", "individual", "Upstox", 1727690000L);
        when(upstoxService.exchangeCodeForToken(eq("valid-code"))).thenReturn(status);

        mockMvc.perform(get("/api/upstox/callback")
                        .param("code", "valid-code")
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.connected").value(true))
                .andExpect(jsonPath("$.userName").value("Rajesh Sharma"))
                .andExpect(jsonPath("$.userId").value("RS1234"));
    }

    @Test
    @DisplayName("4. GET /api/upstox/callback with error returns HTTP 400")
    void testCallbackError() throws Exception {
        mockMvc.perform(get("/api/upstox/callback")
                        .param("error", "access_denied")
                        .param("error_description", "User rejected access")
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("access_denied"))
                .andExpect(jsonPath("$.message").value("User rejected access"));
    }

    @Test
    @DisplayName("5. GET /api/upstox/status returns current connection state")
    void testGetStatus() throws Exception {
        UpstoxAuthStatusDto status = UpstoxAuthStatusDto.connected("Rajesh Sharma", "RS1234", "trader@example.com", "individual", "Upstox", 1727690000L);
        when(upstoxService.getAuthStatus()).thenReturn(status);

        mockMvc.perform(get("/api/upstox/status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.connected").value(true))
                .andExpect(jsonPath("$.userName").value("Rajesh Sharma"));
    }

    @Test
    @DisplayName("6. GET /api/upstox/quote returns Indian stock quote")
    void testGetQuote() throws Exception {
        StockQuoteDto quote = new StockQuoteDto(
                "RELIANCE",
                "Reliance Industries Ltd",
                new BigDecimal("2950.00"),
                new BigDecimal("35.00"),
                "+1.20%",
                new BigDecimal("2915.00"),
                new BigDecimal("2920.00"),
                new BigDecimal("2960.00"),
                new BigDecimal("2910.00"),
                5000000L,
                "2026-09-30",
                1727690000L
        );
        when(upstoxService.getQuote(eq("RELIANCE"))).thenReturn(quote);

        mockMvc.perform(get("/api/upstox/quote")
                        .param("symbol", "RELIANCE"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.symbol").value("RELIANCE"))
                .andExpect(jsonPath("$.price").value(2950.00))
                .andExpect(jsonPath("$.change").value(35.00));
    }

    @Test
    @DisplayName("7. GET /api/upstox/candles returns Indian stock candles")
    void testGetCandles() throws Exception {
        List<CandleDto> candles = List.of(
                new CandleDto(1727690000L, "2026-09-30 15:30:00", new BigDecimal("2900"), new BigDecimal("2950"), new BigDecimal("2890"), new BigDecimal("2945"), 100000L)
        );
        CandleSeriesDto series = new CandleSeriesDto("TCS", "30minute", "INR", "NSE", "EQUITY", candles);
        when(upstoxService.getCandles(eq("TCS"), anyString(), anyInt())).thenReturn(series);

        mockMvc.perform(get("/api/upstox/candles")
                        .param("symbol", "TCS")
                        .param("interval", "30minute")
                        .param("outputsize", "60"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.symbol").value("TCS"))
                .andExpect(jsonPath("$.candles[0].close").value(2945));
    }

    @Test
    @DisplayName("8. GET /api/upstox/search returns Indian stock search results")
    void testSearchSymbols() throws Exception {
        StockSearchResponseDto results = new StockSearchResponseDto(
                List.of(new StockSearchItemDto("RELIANCE", "Reliance Industries Ltd", "EQUITY", "India", "INR", null)),
                "RELIANCE"
        );
        when(upstoxService.searchSymbols(eq("RELIANCE"))).thenReturn(results);

        mockMvc.perform(get("/api/upstox/search")
                        .param("keywords", "RELIANCE"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.bestMatches[0].symbol").value("RELIANCE"));
    }

    @Test
    @DisplayName("9. POST /api/upstox/logout clears session")
    void testLogout() throws Exception {
        mockMvc.perform(post("/api/upstox/logout"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Upstox session disconnected"));
    }
}
