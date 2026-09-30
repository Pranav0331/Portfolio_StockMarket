package com.portfolio.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.portfolio.dto.market.CandleSeriesDto;
import com.portfolio.dto.market.StockQuoteDto;
import com.portfolio.dto.market.StockSearchResponseDto;
import com.portfolio.dto.upstox.UpstoxAuthStatusDto;
import com.portfolio.entity.UpstoxSession;
import com.portfolio.repository.UpstoxSessionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.containsString;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withBadRequest;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class UpstoxServiceTest {

    private RestTemplate restTemplate;
    private MockRestServiceServer mockServer;
    private UpstoxService upstoxService;
    private ObjectMapper objectMapper;
    private UpstoxSessionRepository upstoxSessionRepository;

    @BeforeEach
    void setUp() {
        restTemplate = new RestTemplate();
        mockServer = MockRestServiceServer.createServer(restTemplate);
        objectMapper = new ObjectMapper();
        upstoxSessionRepository = Mockito.mock(UpstoxSessionRepository.class);
        upstoxService = new UpstoxService(restTemplate, objectMapper, upstoxSessionRepository);

        ReflectionTestUtils.setField(upstoxService, "clientId", "mock-client-id");
        ReflectionTestUtils.setField(upstoxService, "clientSecret", "mock-client-secret");
        ReflectionTestUtils.setField(upstoxService, "redirectUri", "http://localhost:8080/api/upstox/callback");
        ReflectionTestUtils.setField(upstoxService, "baseUrl", "https://api.upstox.com/v2");
        ReflectionTestUtils.setField(upstoxService, "authUrl", "https://api.upstox.com/v2/login/authorization/dialog");
    }

    @Test
    @DisplayName("1. Generate valid Upstox OAuth authorization URL")
    void testGetAuthorizationUrl() {
        String authUrl = upstoxService.getAuthorizationUrl();

        assertThat(authUrl).contains("https://api.upstox.com/v2/login/authorization/dialog");
        assertThat(authUrl).contains("client_id=mock-client-id");
        assertThat(authUrl).contains("response_type=code");
        assertThat(authUrl).contains("redirect_uri=http://localhost:8080/api/upstox/callback");
    }

    @Test
    @DisplayName("2. Successfully exchange authorization code for access token")
    void testExchangeCodeForTokenSuccess() {
        String jsonResponse = """
                {
                    "email": "trader@example.com",
                    "user_name": "Rajesh Sharma",
                    "user_id": "RS1234",
                    "user_type": "individual",
                    "access_token": "mock-upstox-access-token-xyz",
                    "extended_token": "mock-extended-token",
                    "is_active": true
                }
                """;

        mockServer.expect(requestTo("https://api.upstox.com/v2/login/authorization/token"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess(jsonResponse, MediaType.APPLICATION_JSON));

        UpstoxAuthStatusDto status = upstoxService.exchangeCodeForToken("valid-auth-code");

        mockServer.verify();
        assertThat(status.connected()).isTrue();
        assertThat(status.userName()).isEqualTo("Rajesh Sharma");
        assertThat(status.userId()).isEqualTo("RS1234");
        assertThat(status.email()).isEqualTo("trader@example.com");

        // Verify status endpoint reflects connection
        UpstoxAuthStatusDto currentStatus = upstoxService.getAuthStatus();
        assertThat(currentStatus.connected()).isTrue();
        assertThat(currentStatus.userName()).isEqualTo("Rajesh Sharma");
    }

    @Test
    @DisplayName("3. Handle error when code exchange fails")
    void testExchangeCodeForTokenFailure() {
        mockServer.expect(requestTo("https://api.upstox.com/v2/login/authorization/token"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withBadRequest().body("{\"status\":\"error\",\"message\":\"Invalid code\"}"));

        assertThatThrownBy(() -> upstoxService.exchangeCodeForToken("invalid-code"))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Failed to exchange Upstox code");
    }

    @Test
    @DisplayName("4. Fetch real-time Indian stock quote from Upstox")
    void testGetIndianStockQuote() {
        // First authenticate
        upstoxService.setAccessToken("test-access-token", "Rajesh Sharma", "RS1234");

        String quoteJson = """
                {
                    "status": "success",
                    "data": {
                        "NSE_EQ:RELIANCE": {
                            "ohlc": {
                                "open": 2920.0,
                                "high": 2980.5,
                                "low": 2910.0,
                                "close": 2915.0
                            },
                            "timestamp": "2026-09-30T15:30:00.000+05:30",
                            "instrument_token": "NSE_EQ|INE002A01018",
                            "symbol": "RELIANCE",
                            "last_price": 2965.25,
                            "volume": 6250000,
                            "net_change": 50.25
                        }
                    }
                }
                """;

        mockServer.expect(requestTo(containsString("/market-quote/quotes")))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess(quoteJson, MediaType.APPLICATION_JSON));

        StockQuoteDto quote = upstoxService.getQuote("RELIANCE");

        mockServer.verify();
        assertThat(quote).isNotNull();
        assertThat(quote.symbol()).isEqualTo("RELIANCE");
        assertThat(quote.price()).isEqualByComparingTo(new BigDecimal("2965.25"));
        assertThat(quote.open()).isEqualByComparingTo(new BigDecimal("2920.0"));
        assertThat(quote.high()).isEqualByComparingTo(new BigDecimal("2980.5"));
        assertThat(quote.low()).isEqualByComparingTo(new BigDecimal("2910.0"));
        assertThat(quote.previousClose()).isEqualByComparingTo(new BigDecimal("2915.0"));
        assertThat(quote.change()).isEqualByComparingTo(new BigDecimal("50.25"));
        assertThat(quote.volume()).isEqualTo(6250000L);
    }

    @Test
    @DisplayName("5. Fetch Indian stock historical candlestick data from Upstox")
    void testGetIndianCandles() {
        upstoxService.setAccessToken("test-access-token", "Rajesh Sharma", "RS1234");

        String candlesJson = """
                {
                    "status": "success",
                    "data": {
                        "candles": [
                            ["2026-09-30T15:30:00+05:30", 2950.0, 2965.0, 2945.0, 2960.0, 150000, 0],
                            ["2026-09-30T15:00:00+05:30", 2930.0, 2955.0, 2925.0, 2948.0, 180000, 0],
                            ["2026-09-30T14:30:00+05:30", 2910.0, 2935.0, 2905.0, 2928.0, 210000, 0]
                        ]
                    }
                }
                """;

        mockServer.expect(requestTo(containsString("/historical-candle/")))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess(candlesJson, MediaType.APPLICATION_JSON));

        CandleSeriesDto result = upstoxService.getCandles("TCS", "30min", 60);

        mockServer.verify();
        assertThat(result).isNotNull();
        assertThat(result.getSymbol()).isEqualTo("TCS");
        assertThat(result.getCandles()).hasSize(3);

        // Sorted ascending chronologically: 14:30 first, 15:30 last
        assertThat(result.getCandles().get(0).getOpen()).isEqualByComparingTo(new BigDecimal("2910.0"));
        assertThat(result.getCandles().get(2).getClose()).isEqualByComparingTo(new BigDecimal("2960.0"));
    }

    @Test
    @DisplayName("6. Search Indian symbols in catalog")
    void testSearchIndianSymbols() {
        StockSearchResponseDto results = upstoxService.searchSymbols("NIFTY");

        assertThat(results.bestMatches()).isNotEmpty();
        assertThat(results.bestMatches()).anyMatch(item -> item.symbol().equals("NIFTY 50"));
    }

    @Test
    @DisplayName("7. Resolve instrument keys properly")
    void testInstrumentResolution() {
        assertThat(upstoxService.resolveInstrumentKey("RELIANCE")).isEqualTo("NSE_EQ|INE002A01018");
        assertThat(upstoxService.resolveInstrumentKey("RELIANCE.NSE")).isEqualTo("NSE_EQ|INE002A01018");
        assertThat(upstoxService.resolveInstrumentKey("NIFTY 50")).isEqualTo("NSE_INDEX|Nifty 50");
        assertThat(upstoxService.resolveInstrumentKey("SENSEX")).isEqualTo("BSE_INDEX|SENSEX");
        assertThat(upstoxService.resolveInstrumentKey("NSE_EQ|INE040A01034")).isEqualTo("NSE_EQ|INE040A01034");
    }

    @Test
    @DisplayName("8. Identify Indian symbol variants correctly")
    void testIsIndianSymbol() {
        assertThat(upstoxService.isIndianSymbol("RELIANCE")).isTrue();
        assertThat(upstoxService.isIndianSymbol("TCS.NSE")).isTrue();
        assertThat(upstoxService.isIndianSymbol("NSE:INFY")).isTrue();
        assertThat(upstoxService.isIndianSymbol("NIFTY 50")).isTrue();
        assertThat(upstoxService.isIndianSymbol("AAPL")).isFalse();
        assertThat(upstoxService.isIndianSymbol("BTC/USD")).isFalse();
    }

    @Test
    @DisplayName("9. Reject market queries when not authenticated")
    void testUnauthenticatedMarketQuery() {
        upstoxService.logout();

        assertThatThrownBy(() -> upstoxService.getQuote("RELIANCE"))
                .isInstanceOf(ResponseStatusException.class)
                .hasFieldOrPropertyWithValue("status", HttpStatus.UNAUTHORIZED);
    }

    @Test
    @DisplayName("10. Load persisted Upstox session on startup from database")
    void testLoadPersistedSessionOnStartup() {
        UpstoxSession persistedSession = new UpstoxSession(
                "DEFAULT",
                "persisted-access-token-123",
                "persisted-ext-token",
                "Amit Patel",
                "AP9999",
                "amit@example.com",
                "individual",
                "Upstox",
                true,
                1727700000L
        );
        when(upstoxSessionRepository.findFirstByIsActiveTrueOrderByUpdatedAtDesc())
                .thenReturn(Optional.of(persistedSession));

        upstoxService.loadPersistedSession();

        UpstoxAuthStatusDto status = upstoxService.getAuthStatus();
        assertThat(status.connected()).isTrue();
        assertThat(status.userName()).isEqualTo("Amit Patel");
        assertThat(status.userId()).isEqualTo("AP9999");
        assertThat(status.email()).isEqualTo("amit@example.com");
    }

    @Test
    @DisplayName("11. Persist session to database on successful OAuth token exchange")
    void testPersistSessionOnOAuthExchange() {
        String jsonResponse = """
                {
                    "email": "trader@example.com",
                    "user_name": "Rajesh Sharma",
                    "user_id": "RS1234",
                    "user_type": "individual",
                    "access_token": "mock-upstox-access-token-xyz",
                    "extended_token": "mock-extended-token",
                    "is_active": true
                }
                """;

        mockServer.expect(requestTo("https://api.upstox.com/v2/login/authorization/token"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess(jsonResponse, MediaType.APPLICATION_JSON));

        when(upstoxSessionRepository.findBySessionKey("DEFAULT")).thenReturn(Optional.empty());

        upstoxService.exchangeCodeForToken("valid-auth-code");

        ArgumentCaptor<UpstoxSession> captor = ArgumentCaptor.forClass(UpstoxSession.class);
        verify(upstoxSessionRepository).save(captor.capture());

        UpstoxSession saved = captor.getValue();
        assertThat(saved.getSessionKey()).isEqualTo("DEFAULT");
        assertThat(saved.getAccessToken()).isEqualTo("mock-upstox-access-token-xyz");
        assertThat(saved.getUserName()).isEqualTo("Rajesh Sharma");
        assertThat(saved.getUserId()).isEqualTo("RS1234");
        assertThat(saved.getIsActive()).isTrue();
    }

    @Test
    @DisplayName("12. Deactivate session in database on logout")
    void testDeactivateSessionOnLogout() {
        UpstoxSession existing = new UpstoxSession();
        existing.setSessionKey("DEFAULT");
        existing.setIsActive(true);
        when(upstoxSessionRepository.findBySessionKey("DEFAULT")).thenReturn(Optional.of(existing));

        upstoxService.logout();

        verify(upstoxSessionRepository).save(existing);
        assertThat(existing.getIsActive()).isFalse();
        assertThat(upstoxService.getAuthStatus().connected()).isFalse();
    }
}
