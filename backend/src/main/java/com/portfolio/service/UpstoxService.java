package com.portfolio.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.portfolio.dto.market.CandleDto;
import com.portfolio.dto.market.CandleSeriesDto;
import com.portfolio.dto.market.FundamentalDataDto;
import com.portfolio.dto.market.StockQuoteDto;
import com.portfolio.dto.market.StockSearchItemDto;
import com.portfolio.dto.market.StockSearchResponseDto;
import com.portfolio.dto.upstox.UpstoxAuthStatusDto;
import com.portfolio.dto.upstox.UpstoxTokenResponseDto;
import com.portfolio.entity.UpstoxSession;
import com.portfolio.repository.UpstoxSessionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.util.UriComponentsBuilder;

import java.math.BigDecimal;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;

@Service
public class UpstoxService {

    private static final Logger log = LoggerFactory.getLogger(UpstoxService.class);

    private static final ZoneId IST_ZONE = ZoneId.of("Asia/Kolkata");
    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final UpstoxSessionRepository upstoxSessionRepository;

    @Value("${upstox.api.client-id:}")
    private String clientId;

    @Value("${upstox.api.client-secret:}")
    private String clientSecret;

    @Value("${upstox.api.redirect-uri:http://localhost:8080/api/upstox/callback}")
    private String redirectUri;

    @Value("${upstox.api.base-url:https://api.upstox.com/v2}")
    private String baseUrl;

    @Value("${upstox.api.auth-url:https://api.upstox.com/v2/login/authorization/dialog}")
    private String authUrl;

    @Value("${upstox.api.access-token:}")
    private String envAccessToken;

    // In-memory token storage (thread-safe)
    private final AtomicReference<UpstoxTokenHolder> tokenHolder = new AtomicReference<>();

    // Curated instrument map for prominent Indian tickers & indices
    private static final Map<String, String> INSTRUMENT_MAP = new HashMap<>();
    private static final List<StockSearchItemDto> POPULAR_INDIAN_STOCKS = new ArrayList<>();

    static {
        // Indices
        mapInstrument("NIFTY 50", "NSE_INDEX|Nifty 50", "Nifty 50", "INDEX");
        mapInstrument("NIFTY50", "NSE_INDEX|Nifty 50", "Nifty 50", "INDEX");
        mapInstrument("NIFTY", "NSE_INDEX|Nifty 50", "Nifty 50", "INDEX");
        mapInstrument("BANKNIFTY", "NSE_INDEX|Nifty Bank", "Nifty Bank", "INDEX");
        mapInstrument("NIFTY BANK", "NSE_INDEX|Nifty Bank", "Nifty Bank", "INDEX");
        mapInstrument("BANK NIFTY", "NSE_INDEX|Nifty Bank", "Nifty Bank", "INDEX");
        mapInstrument("NIFTYBANK", "NSE_INDEX|Nifty Bank", "Nifty Bank", "INDEX");
        mapInstrument("FINNIFTY", "NSE_INDEX|Nifty Fin Service", "Nifty Financial Services", "INDEX");
        mapInstrument("NIFTY FIN SERVICE", "NSE_INDEX|Nifty Fin Service", "Nifty Financial Services", "INDEX");
        mapInstrument("NIFTYFINSERVICE", "NSE_INDEX|Nifty Fin Service", "Nifty Financial Services", "INDEX");
        mapInstrument("NIFTY IT", "NSE_INDEX|Nifty IT", "Nifty IT", "INDEX");
        mapInstrument("NIFTYIT", "NSE_INDEX|Nifty IT", "Nifty IT", "INDEX");
        mapInstrument("NIFTY AUTO", "NSE_INDEX|Nifty Auto", "Nifty Auto", "INDEX");
        mapInstrument("NIFTYAUTO", "NSE_INDEX|Nifty Auto", "Nifty Auto", "INDEX");
        mapInstrument("MIDCPNIFTY", "NSE_INDEX|NIFTY MID SELECT", "Nifty Midcap Select", "INDEX");
        mapInstrument("SENSEX", "BSE_INDEX|SENSEX", "BSE Sensex", "INDEX");
        mapInstrument("BSESENSEX", "BSE_INDEX|SENSEX", "BSE Sensex", "INDEX");

        // Top NSE Equities
        mapInstrument("RELIANCE", "NSE_EQ|INE002A01018", "Reliance Industries Ltd", "EQUITY");
        mapInstrument("TCS", "NSE_EQ|INE467B01029", "Tata Consultancy Services Ltd", "EQUITY");
        mapInstrument("HDFCBANK", "NSE_EQ|INE040A01034", "HDFC Bank Ltd", "EQUITY");
        mapInstrument("INFY", "NSE_EQ|INE009A01021", "Infosys Ltd", "EQUITY");
        mapInstrument("ICICIBANK", "NSE_EQ|INE090A01021", "ICICI Bank Ltd", "EQUITY");
        mapInstrument("SBIN", "NSE_EQ|INE062A01020", "State Bank of India", "EQUITY");
        mapInstrument("BHARTIARTL", "NSE_EQ|INE397D01024", "Bharti Airtel Ltd", "EQUITY");
        mapInstrument("ITC", "NSE_EQ|INE154A01025", "ITC Ltd", "EQUITY");
        mapInstrument("KOTAKBANK", "NSE_EQ|INE237A01028", "Kotak Mahindra Bank Ltd", "EQUITY");
        mapInstrument("LT", "NSE_EQ|INE018A01030", "Larsen & Toubro Ltd", "EQUITY");
        mapInstrument("HINDUNILVR", "NSE_EQ|INE030A01027", "Hindustan Unilever Ltd", "EQUITY");
        mapInstrument("AXISBANK", "NSE_EQ|INE238A01034", "Axis Bank Ltd", "EQUITY");
        mapInstrument("BAJFINANCE", "NSE_EQ|INE296A01024", "Bajaj Finance Ltd", "EQUITY");
        mapInstrument("MARUTI", "NSE_EQ|INE585B01010", "Maruti Suzuki India Ltd", "EQUITY");
        mapInstrument("TATAMOTORS", "NSE_EQ|INE155A01022", "Tata Motors Ltd", "EQUITY");
        mapInstrument("TATASTEEL", "NSE_EQ|INE081A01020", "Tata Steel Ltd", "EQUITY");
        mapInstrument("WIPRO", "NSE_EQ|INE075A01022", "Wipro Ltd", "EQUITY");
        mapInstrument("ASIANPAINT", "NSE_EQ|INE021A01026", "Asian Paints Ltd", "EQUITY");
        mapInstrument("SUNPHARMA", "NSE_EQ|INE044A01036", "Sun Pharmaceutical Industries Ltd", "EQUITY");
        mapInstrument("TITAN", "NSE_EQ|INE280A01028", "Titan Company Ltd", "EQUITY");
        mapInstrument("ADANIENT", "NSE_EQ|INE423A01024", "Adani Enterprises Ltd", "EQUITY");
        mapInstrument("ADANIPORTS", "NSE_EQ|INE742F01042", "Adani Ports & SEZ Ltd", "EQUITY");
        mapInstrument("NTPC", "NSE_EQ|INE733E01010", "NTPC Ltd", "EQUITY");
        mapInstrument("POWERGRID", "NSE_EQ|INE752E01010", "Power Grid Corporation of India", "EQUITY");
        mapInstrument("ONGC", "NSE_EQ|INE213A01029", "Oil & Natural Gas Corporation Ltd", "EQUITY");
        mapInstrument("COALINDIA", "NSE_EQ|INE522F01014", "Coal India Ltd", "EQUITY");
        mapInstrument("BAJAJFINSV", "NSE_EQ|INE918I01018", "Bajaj Finserv Ltd", "EQUITY");
        mapInstrument("JSWSTEEL", "NSE_EQ|INE019A01038", "JSW Steel Ltd", "EQUITY");
        mapInstrument("HCLTECH", "NSE_EQ|INE860A01027", "HCL Technologies Ltd", "EQUITY");
        mapInstrument("DRREDDY", "NSE_EQ|INE089A01023", "Dr. Reddy's Laboratories Ltd", "EQUITY");
        mapInstrument("EICHERMOT", "NSE_EQ|INE066A01021", "Eicher Motors Ltd", "EQUITY");
        mapInstrument("NESTLEIND", "NSE_EQ|INE239A01016", "Nestle India Ltd", "EQUITY");
        mapInstrument("ULTRACEMCO", "NSE_EQ|INE481G01011", "UltraTech Cement Ltd", "EQUITY");
        mapInstrument("ZOMATO", "NSE_EQ|INE758T01015", "Zomato Ltd", "EQUITY");
        mapInstrument("JIOFIN", "NSE_EQ|INE758E01017", "Jio Financial Services Ltd", "EQUITY");
        mapInstrument("BEL", "NSE_EQ|INE263A01024", "Bharat Electronics Ltd", "EQUITY");
        mapInstrument("HAL", "NSE_EQ|INE066F01012", "Hindustan Aeronautics Ltd", "EQUITY");
    }

    private static void mapInstrument(String ticker, String instrumentKey, String name, String type) {
        String upper = ticker.toUpperCase(Locale.ROOT);
        INSTRUMENT_MAP.put(upper, instrumentKey);
        INSTRUMENT_MAP.put(upper.replace(" ", ""), instrumentKey);
        INSTRUMENT_MAP.put(upper.replace(" ", "_"), instrumentKey);
        INSTRUMENT_MAP.put(upper.replace(" ", "-"), instrumentKey);
        INSTRUMENT_MAP.put(upper + ".NSE", instrumentKey);
        INSTRUMENT_MAP.put(upper + ".BSE", instrumentKey);
        INSTRUMENT_MAP.put("NSE:" + upper, instrumentKey);
        INSTRUMENT_MAP.put("BSE:" + upper, instrumentKey);
        INSTRUMENT_MAP.put("NSE_INDEX|" + upper, instrumentKey);
        INSTRUMENT_MAP.put("BSE_INDEX|" + upper, instrumentKey);
        INSTRUMENT_MAP.put("NSE_EQ|" + upper, instrumentKey);
        INSTRUMENT_MAP.put("BSE_EQ|" + upper, instrumentKey);
        POPULAR_INDIAN_STOCKS.add(new StockSearchItemDto(ticker, name, type, "India", "INR", null));
    }

    @org.springframework.beans.factory.annotation.Autowired
    public UpstoxService(RestTemplateBuilder restTemplateBuilder, ObjectMapper objectMapper,
                         @org.springframework.beans.factory.annotation.Autowired(required = false) UpstoxSessionRepository upstoxSessionRepository,
                         @Value("${upstox.api.timeout-ms:25000}") int timeoutMs) {
        this.restTemplate = restTemplateBuilder
                .connectTimeout(Duration.ofMillis(timeoutMs))
                .readTimeout(Duration.ofMillis(timeoutMs))
                .build();
        this.objectMapper = objectMapper;
        this.upstoxSessionRepository = upstoxSessionRepository;
    }

    UpstoxService(RestTemplate restTemplate, ObjectMapper objectMapper) {
        this(restTemplate, objectMapper, null);
    }

    UpstoxService(RestTemplate restTemplate, ObjectMapper objectMapper, UpstoxSessionRepository upstoxSessionRepository) {
        this.restTemplate = restTemplate;
        this.objectMapper = objectMapper;
        this.upstoxSessionRepository = upstoxSessionRepository;
    }

    @jakarta.annotation.PostConstruct
    public void loadPersistedSession() {
        if (upstoxSessionRepository != null) {
            try {
                Optional<UpstoxSession> optSession = upstoxSessionRepository.findFirstByIsActiveTrueOrderByUpdatedAtDesc();
                if (optSession.isEmpty()) {
                    optSession = upstoxSessionRepository.findBySessionKey("DEFAULT");
                }
                optSession.ifPresent(session -> {
                    if (session.getAccessToken() != null && !session.getAccessToken().trim().isEmpty()) {
                        this.tokenHolder.set(new UpstoxTokenHolder(
                                session.getAccessToken(),
                                session.getUserName(),
                                session.getUserId(),
                                session.getEmail(),
                                session.getUserType(),
                                session.getBroker(),
                                session.getConnectedAt() != null ? session.getConnectedAt() : System.currentTimeMillis()
                        ));
                        String displayName = session.getUserName() != null ? session.getUserName() : session.getUserId();
                        log.info("Successfully loaded persisted Upstox session from database for user: {}", displayName);
                    }
                });
            } catch (Exception e) {
                log.warn("Could not load persisted Upstox session from database: {}", e.getMessage());
            }
        }
    }

    /**
     * Build the Upstox OAuth 2.0 authorization URL
     */
    public String getAuthorizationUrl() {
        if (clientId == null || clientId.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "UPSTOX_CLIENT_ID is not configured in backend .env");
        }
        String redirect = (redirectUri != null && !redirectUri.trim().isEmpty()) ? redirectUri.trim() : "http://localhost:8080/api/upstox/callback";
        return UriComponentsBuilder.fromHttpUrl(authUrl)
                .queryParam("response_type", "code")
                .queryParam("client_id", clientId.trim())
                .queryParam("redirect_uri", redirect)
                .encode()
                .toUriString();
    }

    /**
     * Exchange the authorization code for an Upstox access token securely on the backend
     */
    public UpstoxAuthStatusDto exchangeCodeForToken(String code) {
        if (code == null || code.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Authorization code is required");
        }
        if (clientId == null || clientId.trim().isEmpty() || clientSecret == null || clientSecret.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Upstox credentials (UPSTOX_CLIENT_ID / UPSTOX_CLIENT_SECRET) not configured");
        }

        String tokenEndpoint = baseUrl + "/login/authorization/token";
        log.info("Exchanging Upstox authorization code for access token at endpoint: {}", tokenEndpoint);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
        headers.setAccept(List.of(MediaType.APPLICATION_JSON));

        MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
        body.add("code", code.trim());
        body.add("client_id", clientId.trim());
        body.add("client_secret", clientSecret.trim());
        body.add("redirect_uri", redirectUri.trim());
        body.add("grant_type", "authorization_code");

        HttpEntity<MultiValueMap<String, String>> requestEntity = new HttpEntity<>(body, headers);

        try {
            ResponseEntity<String> response = restTemplate.postForEntity(tokenEndpoint, requestEntity, String.class);
            if (response.getBody() == null || response.getBody().trim().isEmpty()) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Received empty response from Upstox token service");
            }

            UpstoxTokenResponseDto tokenResponse = objectMapper.readValue(response.getBody(), UpstoxTokenResponseDto.class);

            if (tokenResponse.getAccessToken() == null || tokenResponse.getAccessToken().trim().isEmpty()) {
                log.warn("Upstox token response did not contain an access token");
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid token response from Upstox");
            }

            UpstoxTokenHolder holder = new UpstoxTokenHolder(
                    tokenResponse.getAccessToken(),
                    tokenResponse.getUserName(),
                    tokenResponse.getUserId(),
                    tokenResponse.getEmail(),
                    tokenResponse.getUserType(),
                    tokenResponse.getBroker(),
                    System.currentTimeMillis()
            );

            this.tokenHolder.set(holder);
            saveSessionToDatabase(holder, tokenResponse.getExtendedToken());

            log.info("Successfully authenticated with Upstox for user: {}", holder.userName != null ? holder.userName : holder.userId);

            return UpstoxAuthStatusDto.connected(
                    holder.userName,
                    holder.userId,
                    holder.email,
                    holder.userType,
                    holder.broker,
                    holder.connectedAt
            );

        } catch (HttpStatusCodeException e) {
            log.error("Upstox token exchange failed with HTTP status: {}", e.getStatusCode());
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Failed to exchange Upstox code: " + e.getResponseBodyAsString());
        } catch (ResponseStatusException e) {
            throw e;
        } catch (RestClientException e) {
            log.error("Network error communicating with Upstox token API: {}", e.getMessage());
            throw new ResponseStatusException(HttpStatus.GATEWAY_TIMEOUT, "Upstox token provider timed out or is unavailable");
        } catch (Exception e) {
            log.error("Unexpected error during Upstox token exchange: {}", e.getMessage());
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Error exchanging Upstox authorization code");
        }
    }

    /**
     * Manually set an access token (e.g., from Upstox Developer Console)
     */
    public UpstoxAuthStatusDto setAccessToken(String accessToken, String userName, String userId) {
        if (accessToken == null || accessToken.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Access token cannot be empty");
        }
        UpstoxTokenHolder holder = new UpstoxTokenHolder(
                accessToken.trim(),
                userName != null ? userName.trim() : "Upstox User",
                userId != null ? userId.trim() : "UPSTOX_USER",
                null,
                "individual",
                "Upstox",
                System.currentTimeMillis()
        );
        this.tokenHolder.set(holder);
        saveSessionToDatabase(holder, null);
        log.info("Upstox access token manually configured");
        return UpstoxAuthStatusDto.connected(holder.userName, holder.userId, holder.email, holder.userType, holder.broker, holder.connectedAt);
    }

    /**
     * Get current Upstox connection status
     */
    public UpstoxAuthStatusDto getAuthStatus() {
        UpstoxTokenHolder holder = tokenHolder.get();
        if (holder != null && holder.accessToken != null && !holder.accessToken.trim().isEmpty()) {
            return UpstoxAuthStatusDto.connected(
                    holder.userName,
                    holder.userId,
                    holder.email,
                    holder.userType,
                    holder.broker,
                    holder.connectedAt
            );
        }
        if (envAccessToken != null && !envAccessToken.trim().isEmpty()) {
            return UpstoxAuthStatusDto.connected("Upstox User (Env)", "UPSTOX_ENV", null, "individual", "Upstox", System.currentTimeMillis());
        }
        if (upstoxSessionRepository != null) {
            try {
                Optional<UpstoxSession> optSession = upstoxSessionRepository.findFirstByIsActiveTrueOrderByUpdatedAtDesc();
                if (optSession.isEmpty()) {
                    optSession = upstoxSessionRepository.findBySessionKey("DEFAULT");
                }
                if (optSession.isPresent()) {
                    UpstoxSession session = optSession.get();
                    if (session.getAccessToken() != null && !session.getAccessToken().trim().isEmpty()) {
                        UpstoxTokenHolder loaded = new UpstoxTokenHolder(
                                session.getAccessToken(),
                                session.getUserName(),
                                session.getUserId(),
                                session.getEmail(),
                                session.getUserType(),
                                session.getBroker(),
                                session.getConnectedAt() != null ? session.getConnectedAt() : System.currentTimeMillis()
                        );
                        this.tokenHolder.set(loaded);
                        return UpstoxAuthStatusDto.connected(
                                loaded.userName,
                                loaded.userId,
                                loaded.email,
                                loaded.userType,
                                loaded.broker,
                                loaded.connectedAt
                        );
                    }
                }
            } catch (Exception e) {
                log.warn("Could not retrieve Upstox session from database: {}", e.getMessage());
            }
        }
        return UpstoxAuthStatusDto.disconnected("Not connected to Upstox. Please authenticate via OAuth.");
    }

    /**
     * Disconnect/logout from Upstox
     */
    public void logout() {
        tokenHolder.set(null);
        if (upstoxSessionRepository != null) {
            try {
                upstoxSessionRepository.findBySessionKey("DEFAULT").ifPresent(session -> {
                    session.setIsActive(false);
                    upstoxSessionRepository.save(session);
                });
            } catch (Exception e) {
                log.warn("Could not update Upstox session in database on logout: {}", e.getMessage());
            }
        }
        log.info("Cleared active Upstox session token");
    }

    private void saveSessionToDatabase(UpstoxTokenHolder holder, String extendedToken) {
        if (upstoxSessionRepository != null) {
            try {
                UpstoxSession session = upstoxSessionRepository.findBySessionKey("DEFAULT")
                        .orElseGet(() -> {
                            UpstoxSession s = new UpstoxSession();
                            s.setSessionKey("DEFAULT");
                            return s;
                        });
                session.setAccessToken(holder.accessToken);
                if (extendedToken != null) {
                    session.setExtendedToken(extendedToken);
                }
                session.setUserName(holder.userName);
                session.setUserId(holder.userId);
                session.setEmail(holder.email);
                session.setUserType(holder.userType);
                session.setBroker(holder.broker);
                session.setIsActive(true);
                session.setConnectedAt(holder.connectedAt);
                upstoxSessionRepository.save(session);
                log.info("Persisted Upstox session to database");
            } catch (Exception e) {
                log.warn("Could not persist Upstox session to database: {}", e.getMessage());
            }
        }
    }

    /**
     * Fetch real-time market quote for Indian stocks/indices from Upstox
     */
    public StockQuoteDto getQuote(String symbol) {
        if (symbol == null || symbol.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Symbol parameter is required");
        }

        String instrumentKey = resolveInstrumentKey(symbol);
        String token = getValidAccessToken();

        java.net.URI uri = UriComponentsBuilder.fromHttpUrl(baseUrl + "/market-quote/quotes")
                .queryParam("instrument_key", instrumentKey)
                .build()
                .toUri();

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        headers.setAccept(List.of(MediaType.APPLICATION_JSON));
        HttpEntity<Void> entity = new HttpEntity<>(headers);

        try {
            log.info("Fetching Upstox market quote for instrument: {}", instrumentKey);
            ResponseEntity<String> response = restTemplate.exchange(uri, HttpMethod.GET, entity, String.class);

            if (response.getBody() == null || response.getBody().trim().isEmpty()) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Empty response from Upstox quote API");
            }

            JsonNode root = objectMapper.readTree(response.getBody());
            checkUpstoxError(root, symbol);

            JsonNode dataNode = root.path("data");
            if (dataNode.isMissingNode() || dataNode.isEmpty()) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No market data found on Upstox for: " + symbol);
            }

            // The data object keys are the instrument format e.g. "NSE_EQ:RELIANCE" or "NSE_INDEX:Nifty 50"
            JsonNode quoteNode = null;
            if (dataNode.has(instrumentKey)) {
                quoteNode = dataNode.get(instrumentKey);
            } else if (dataNode.has(instrumentKey.replace("|", ":"))) {
                quoteNode = dataNode.get(instrumentKey.replace("|", ":"));
            } else if (dataNode.has(instrumentKey.replace(":", "|"))) {
                quoteNode = dataNode.get(instrumentKey.replace(":", "|"));
            } else {
                // Search fields for match or pick the first entry
                for (var it = dataNode.fields(); it.hasNext(); ) {
                    var entry = it.next();
                    if (entry.getKey().equalsIgnoreCase(instrumentKey) ||
                        entry.getKey().replace(":", "|").equalsIgnoreCase(instrumentKey) ||
                        entry.getKey().replace("|", ":").equalsIgnoreCase(instrumentKey)) {
                        quoteNode = entry.getValue();
                        break;
                    }
                }
                if (quoteNode == null) {
                    var fields = dataNode.fields();
                    if (fields.hasNext()) {
                        quoteNode = fields.next().getValue();
                    }
                }
            }

            if (quoteNode == null || quoteNode.isMissingNode()) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Quote data empty for: " + symbol);
            }

            JsonNode ohlcNode = quoteNode.path("ohlc");
            BigDecimal lastPrice = parseBigDecimal(quoteNode.path("last_price").asText(null));
            BigDecimal open = parseBigDecimal(ohlcNode.path("open").asText(null));
            BigDecimal high = parseBigDecimal(ohlcNode.path("high").asText(null));
            BigDecimal low = parseBigDecimal(ohlcNode.path("low").asText(null));
            BigDecimal close = parseBigDecimal(ohlcNode.path("close").asText(null));
            BigDecimal netChange = parseBigDecimal(quoteNode.path("net_change").asText(null));
            Long volume = parseLong(quoteNode.path("volume").asText(null));
            String symbolOut = quoteNode.path("symbol").asText(quoteNode.path("trading_symbol").asText(symbol.toUpperCase(Locale.ROOT)));
            String timestampStr = quoteNode.path("timestamp").asText(null);
            Long timestamp = parseEpochFromIso(timestampStr);

            BigDecimal currentPrice = lastPrice != null ? lastPrice : close;
            if (currentPrice == null) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Price not available for: " + symbol);
            }

            String changePercent = null;
            if (close != null && close.compareTo(BigDecimal.ZERO) > 0 && netChange != null) {
                BigDecimal pct = netChange.divide(close, 4, java.math.RoundingMode.HALF_UP).multiply(BigDecimal.valueOf(100));
                changePercent = (pct.compareTo(BigDecimal.ZERO) > 0 ? "+" : "") + String.format("%.2f%%", pct);
            }

            return new StockQuoteDto(
                    symbolOut,
                    symbolOut,
                    currentPrice,
                    netChange,
                    changePercent,
                    close,
                    open,
                    high,
                    low,
                    volume,
                    timestampStr,
                    timestamp
            );

        } catch (HttpStatusCodeException e) {
            log.error("Upstox quote API error HTTP {}: {}", e.getStatusCode(), e.getResponseBodyAsString());
            if (e.getStatusCode() == HttpStatus.UNAUTHORIZED) {
                logout();
                throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Upstox token expired or invalid. Please re-authenticate via /api/upstox/login");
            }
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Upstox market quote error: " + e.getMessage());
        } catch (ResponseStatusException e) {
            throw e;
        } catch (RestClientException e) {
            log.error("Network error communicating with Upstox quotes: {}", e.getMessage());
            throw new ResponseStatusException(HttpStatus.GATEWAY_TIMEOUT, "Upstox quote request timed out");
        } catch (Exception e) {
            log.error("Unexpected error processing Upstox quote for {}: {}", symbol, e.getMessage());
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Error reading Upstox quote response");
        }
    }

    /**
     * Fetch fundamental information for Indian stocks/indices from Upstox
     */
    public FundamentalDataDto getFundamentals(String symbol) {
        if (symbol == null || symbol.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Symbol parameter is required");
        }

        String cleanSymbol = symbol.trim().toUpperCase(Locale.ROOT);
        String instrumentKey = resolveInstrumentKey(cleanSymbol);
        String exchange = instrumentKey.startsWith("NSE") ? "NSE" : "BSE";

        // Find standard company name from curated map or fallback to clean symbol
        String companyName = POPULAR_INDIAN_STOCKS.stream()
                .filter(s -> s.symbol().equalsIgnoreCase(cleanSymbol) || s.name().equalsIgnoreCase(cleanSymbol))
                .map(StockSearchItemDto::name)
                .findFirst()
                .orElse(cleanSymbol);

        BigDecimal fiftyTwoWeekHigh = null;
        BigDecimal fiftyTwoWeekLow = null;
        Long lastUpdated = System.currentTimeMillis();

        try {
            StockQuoteDto quote = getQuote(cleanSymbol);
            if (quote != null) {
                if (quote.name() != null && !quote.name().equalsIgnoreCase(cleanSymbol)) {
                    companyName = quote.name();
                }
                if (quote.timestamp() != null) {
                    lastUpdated = quote.timestamp();
                }
            }
        } catch (Exception e) {
            log.warn("Could not fetch real-time quote for Upstox fundamentals ({}): {}", cleanSymbol, e.getMessage());
        }

        // Upstox basic tier provides quotes and candles, but does not provide SEC-style balance sheets
        // Strictly return null for unsupported financial statements without inventing fake values
        return new FundamentalDataDto(
                cleanSymbol,
                companyName,
                exchange,
                "INR",
                "Upstox",
                null,
                null,
                null,
                null,
                null,
                null, // marketCap (unavailable from Upstox basic quote)
                null, // peRatio (unavailable from Upstox basic quote)
                null, // eps (unavailable from Upstox basic quote)
                null, // roe (unavailable from Upstox basic quote)
                null, // revenue (unavailable from Upstox basic quote)
                null, // netIncome (unavailable from Upstox basic quote)
                null, // dividendYield (unavailable from Upstox basic quote)
                fiftyTwoWeekHigh,
                fiftyTwoWeekLow,
                lastUpdated
        );
    }

    /**
     * Fetch OHLC Candlestick data for Indian stocks/indices from Upstox
     */
    public CandleSeriesDto getCandles(String symbol, String interval, Integer outputsize) {
        if (symbol == null || symbol.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Symbol parameter is required");
        }

        String instrumentKey = resolveInstrumentKey(symbol);
        String token = getValidAccessToken();
        String normalizedInterval = normalizeUpstoxInterval(interval);

        int size = (outputsize != null && outputsize > 0 && outputsize <= 500) ? outputsize : 100;

        // Build URL: /historical-candle/{instrument_key}/{interval}/{to_date}/{from_date} or intraday
        LocalDate today = LocalDate.now(IST_ZONE);
        LocalDate fromDate = today.minusDays(calculateLookbackDays(normalizedInterval, size));

        java.net.URI uri = UriComponentsBuilder.fromHttpUrl(baseUrl)
                .path("/historical-candle/{instrument_key}/{interval}/{to_date}/{from_date}")
                .buildAndExpand(instrumentKey, normalizedInterval, today.format(DATE_FORMAT), fromDate.format(DATE_FORMAT))
                .toUri();

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        headers.setAccept(List.of(MediaType.APPLICATION_JSON));
        HttpEntity<Void> entity = new HttpEntity<>(headers);

        try {
            log.info("Fetching Upstox historical candles for instrument: {}, interval: {}", instrumentKey, normalizedInterval);
            ResponseEntity<String> response = restTemplate.exchange(uri, HttpMethod.GET, entity, String.class);

            if (response.getBody() == null || response.getBody().trim().isEmpty()) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Empty response from Upstox candles API");
            }

            JsonNode root = objectMapper.readTree(response.getBody());
            checkUpstoxError(root, symbol);

            JsonNode candlesArray = root.path("data").path("candles");
            List<CandleDto> candles = new ArrayList<>();

            if (candlesArray != null && candlesArray.isArray()) {
                for (JsonNode candleNode : candlesArray) {
                    if (candleNode.isArray() && candleNode.size() >= 5) {
                        String dtStr = candleNode.get(0).asText();
                        BigDecimal open = parseBigDecimal(candleNode.get(1).asText());
                        BigDecimal high = parseBigDecimal(candleNode.get(2).asText());
                        BigDecimal low = parseBigDecimal(candleNode.get(3).asText());
                        BigDecimal close = parseBigDecimal(candleNode.get(4).asText());
                        Long volume = candleNode.size() >= 6 ? parseLong(candleNode.get(5).asText()) : 0L;
                        Long ts = parseEpochFromIso(dtStr);

                        if (open != null && high != null && low != null && close != null) {
                            candles.add(new CandleDto(ts, dtStr, open, high, low, close, volume));
                        }
                    }
                }
            }

            if (candles.isEmpty()) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No candlestick data found on Upstox for: " + symbol);
            }

            // Upstox returns newest first; reverse to chronological ascending order
            Collections.reverse(candles);

            // Limit output size if needed
            if (candles.size() > size) {
                candles = candles.subList(candles.size() - size, candles.size());
            }

            String exchange = instrumentKey.startsWith("NSE") ? "NSE" : "BSE";
            String type = instrumentKey.contains("INDEX") ? "INDEX" : "EQUITY";
            return new CandleSeriesDto(symbol.toUpperCase(Locale.ROOT), normalizedInterval, "INR", exchange, type, candles);

        } catch (HttpStatusCodeException e) {
            log.error("Upstox candles API error HTTP {}: {}", e.getStatusCode(), e.getResponseBodyAsString());
            if (e.getStatusCode() == HttpStatus.UNAUTHORIZED) {
                logout();
                throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Upstox token expired or invalid. Please re-authenticate via /api/upstox/login");
            }
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Upstox candles error: " + e.getMessage());
        } catch (ResponseStatusException e) {
            throw e;
        } catch (RestClientException e) {
            log.error("Network error communicating with Upstox candles: {}", e.getMessage());
            throw new ResponseStatusException(HttpStatus.GATEWAY_TIMEOUT, "Upstox candles request timed out");
        } catch (Exception e) {
            log.error("Unexpected error processing Upstox candles for {}: {}", symbol, e.getMessage());
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Error reading Upstox candles response");
        }
    }

    /**
     * Search Indian symbols (NSE & BSE)
     */
    public StockSearchResponseDto searchSymbols(String keywords) {
        if (keywords == null || keywords.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Keywords parameter is required");
        }

        String query = keywords.trim().toUpperCase(Locale.ROOT);
        List<StockSearchItemDto> matches = new ArrayList<>();

        for (StockSearchItemDto item : POPULAR_INDIAN_STOCKS) {
            if (item.symbol().toUpperCase(Locale.ROOT).contains(query) ||
                    (item.name() != null && item.name().toUpperCase(Locale.ROOT).contains(query))) {
                matches.add(item);
            }
        }

        return new StockSearchResponseDto(matches, keywords);
    }

    /**
     * Resolve user ticker/symbol to Upstox instrument key
     */
    public String resolveInstrumentKey(String symbol) {
        if (symbol == null || symbol.trim().isEmpty()) {
            return "NSE_EQ|INE002A01018"; // default RELIANCE
        }

        String clean = symbol.trim().toUpperCase(Locale.ROOT);

        // 1. Direct dictionary match (e.g., "BANK NIFTY", "NIFTY 50", "RELIANCE")
        if (INSTRUMENT_MAP.containsKey(clean)) {
            return INSTRUMENT_MAP.get(clean);
        }

        // 2. Check normalized variations (strip or single-space)
        String normalizedSpaces = clean.replaceAll("\\s+", " ");
        if (INSTRUMENT_MAP.containsKey(normalizedSpaces)) {
            return INSTRUMENT_MAP.get(normalizedSpaces);
        }
        String strippedSpaces = clean.replaceAll("\\s+", "");
        if (INSTRUMENT_MAP.containsKey(strippedSpaces)) {
            return INSTRUMENT_MAP.get(strippedSpaces);
        }

        // 3. If symbol contains prefix like NSE_EQ|, NSE_INDEX|, BSE_EQ|, BSE_INDEX|, NSE:, BSE:
        if (clean.contains("|") || clean.contains(":")) {
            int sepIndex = clean.indexOf('|') != -1 ? clean.indexOf('|') : clean.indexOf(':');
            String afterSep = clean.substring(sepIndex + 1).trim();
            if (INSTRUMENT_MAP.containsKey(afterSep)) {
                return INSTRUMENT_MAP.get(afterSep);
            }
            String afterSepNoSpace = afterSep.replaceAll("\\s+", "");
            if (INSTRUMENT_MAP.containsKey(afterSepNoSpace)) {
                return INSTRUMENT_MAP.get(afterSepNoSpace);
            }
        }

        // 4. If it's a known fully-qualified Upstox key with ISIN or exact index key
        if (clean.startsWith("NSE_INDEX|") || clean.startsWith("BSE_INDEX|")
                || (clean.startsWith("NSE_EQ|INE") || clean.startsWith("BSE_EQ|INE"))) {
            return clean;
        }

        if (clean.contains("|")) {
            return clean;
        }

        // 5. Handle .NSE or .BSE suffixes
        if (clean.endsWith(".NSE")) {
            String bare = clean.substring(0, clean.length() - 4).trim();
            if (INSTRUMENT_MAP.containsKey(bare)) {
                return INSTRUMENT_MAP.get(bare);
            }
            return "NSE_EQ|" + bare;
        }

        if (clean.endsWith(".BSE")) {
            String bare = clean.substring(0, clean.length() - 4).trim();
            if (INSTRUMENT_MAP.containsKey(bare)) {
                return INSTRUMENT_MAP.get(bare);
            }
            return "BSE_EQ|" + bare;
        }

        // Default to NSE_EQ
        return "NSE_EQ|" + clean;
    }

    /**
     * Check if a symbol represents an Indian instrument
     */
    public boolean isIndianSymbol(String symbol) {
        if (symbol == null) return false;
        String upper = symbol.trim().toUpperCase(Locale.ROOT);
        return upper.endsWith(".NSE") || upper.endsWith(".BSE") || upper.startsWith("NSE_") || upper.startsWith("BSE_")
                || upper.startsWith("NSE:") || upper.startsWith("BSE:")
                || INSTRUMENT_MAP.containsKey(upper);
    }

    public String getValidAccessToken() {
        UpstoxTokenHolder holder = tokenHolder.get();
        if (holder != null && holder.accessToken != null && !holder.accessToken.trim().isEmpty()) {
            return holder.accessToken;
        }
        if (envAccessToken != null && !envAccessToken.trim().isEmpty()) {
            return envAccessToken.trim();
        }
        if (upstoxSessionRepository != null) {
            try {
                Optional<UpstoxSession> optSession = upstoxSessionRepository.findFirstByIsActiveTrueOrderByUpdatedAtDesc();
                if (optSession.isEmpty()) {
                    optSession = upstoxSessionRepository.findBySessionKey("DEFAULT");
                }
                if (optSession.isPresent()) {
                    UpstoxSession session = optSession.get();
                    if (session.getAccessToken() != null && !session.getAccessToken().trim().isEmpty()) {
                        UpstoxTokenHolder loaded = new UpstoxTokenHolder(
                                session.getAccessToken(),
                                session.getUserName(),
                                session.getUserId(),
                                session.getEmail(),
                                session.getUserType(),
                                session.getBroker(),
                                session.getConnectedAt() != null ? session.getConnectedAt() : System.currentTimeMillis()
                        );
                        this.tokenHolder.set(loaded);
                        return loaded.accessToken;
                    }
                }
            } catch (Exception e) {
                log.warn("Could not lazily load Upstox session from database: {}", e.getMessage());
            }
        }
        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Upstox access token not found. Please log in with Upstox via /api/upstox/login");
    }

    private String normalizeUpstoxInterval(String interval) {
        if (interval == null || interval.trim().isEmpty()) {
            return "30minute";
        }
        String clean = interval.trim().toLowerCase(Locale.ROOT);
        return switch (clean) {
            case "1m", "1min", "1minute" -> "1minute";
            case "5m", "5min", "5minute", "15m", "15min", "30m", "30min", "30minute" -> "30minute";
            case "1h", "60min", "2h", "4h", "1d", "1day", "day", "daily" -> "day";
            case "1w", "1week", "week", "weekly" -> "week";
            case "1mth", "1month", "month", "monthly" -> "month";
            default -> "30minute";
        };
    }

    private int calculateLookbackDays(String interval, int candleCount) {
        return switch (interval) {
            case "1minute" -> Math.max(5, (candleCount / 375) + 3);
            case "30minute" -> Math.max(30, (candleCount / 13) + 7);
            case "day" -> Math.max(90, candleCount * 2);
            case "week" -> Math.max(365, candleCount * 8);
            case "month" -> Math.max(1000, candleCount * 35);
            default -> 60;
        };
    }

    private void checkUpstoxError(JsonNode root, String query) {
        if (root.has("status") && "error".equalsIgnoreCase(root.path("status").asText())) {
            String message = root.path("message").asText("Upstox API returned an error");
            log.warn("Upstox API error for query {}: {}", query, message);
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Upstox API error: " + message);
        }
    }

    private Long parseEpochFromIso(String isoString) {
        if (isoString == null || isoString.trim().isEmpty()) {
            return null;
        }
        try {
            return OffsetDateTime.parse(isoString.trim()).toEpochSecond();
        } catch (Exception e) {
            try {
                return LocalDate.parse(isoString.trim(), DATE_FORMAT).atStartOfDay(IST_ZONE).toEpochSecond();
            } catch (Exception ignored) {
                return null;
            }
        }
    }

    private BigDecimal parseBigDecimal(String val) {
        if (val == null || val.trim().isEmpty() || "null".equalsIgnoreCase(val.trim())) {
            return null;
        }
        try {
            return new BigDecimal(val.trim());
        } catch (Exception e) {
            return null;
        }
    }

    private Long parseLong(String val) {
        if (val == null || val.trim().isEmpty() || "null".equalsIgnoreCase(val.trim())) {
            return null;
        }
        try {
            return Long.parseLong(val.trim());
        } catch (Exception e) {
            return null;
        }
    }

    private record UpstoxTokenHolder(
            String accessToken,
            String userName,
            String userId,
            String email,
            String userType,
            String broker,
            long connectedAt
    ) {}
}
