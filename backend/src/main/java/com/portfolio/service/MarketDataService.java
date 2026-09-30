package com.portfolio.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.portfolio.dto.market.MarketPriceDto;
import com.portfolio.dto.market.StockQuoteDto;
import com.portfolio.dto.market.StockSearchItemDto;
import com.portfolio.dto.market.StockSearchResponseDto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

@Service
public class MarketDataService {

    private static final Logger log = LoggerFactory.getLogger(MarketDataService.class);

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    @Value("${twelvedata.api.key:demo}")
    private String apiKey;

    @Value("${twelvedata.api.base-url:https://api.twelvedata.com}")
    private String baseUrl;

    @org.springframework.beans.factory.annotation.Autowired
    public MarketDataService(RestTemplateBuilder restTemplateBuilder, ObjectMapper objectMapper,
                             @Value("${twelvedata.api.timeout-ms:10000}") int timeoutMs) {
        this.restTemplate = restTemplateBuilder
                .connectTimeout(Duration.ofMillis(timeoutMs))
                .readTimeout(Duration.ofMillis(timeoutMs))
                .build();
        this.objectMapper = objectMapper;
    }

    MarketDataService(RestTemplate restTemplate, ObjectMapper objectMapper) {
        this.restTemplate = restTemplate;
        this.objectMapper = objectMapper;
    }

    /**
     * Fetch real-time Forex price from Twelve Data
     */
    public MarketPriceDto getForexPrice(String symbol) {
        if (symbol == null || symbol.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Symbol parameter is required");
        }

        String cleanSymbol = symbol.trim().toUpperCase();
        String url = String.format("%s/quote?symbol=%s&apikey=%s", baseUrl, cleanSymbol, apiKey);

        try {
            log.info("Fetching Twelve Data forex quote for symbol: {}", cleanSymbol);
            ResponseEntity<String> response = restTemplate.getForEntity(url, String.class);

            if (response.getBody() == null || response.getBody().trim().isEmpty()) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Empty response from Twelve Data API");
            }

            JsonNode root = objectMapper.readTree(response.getBody());
            checkTwelveDataError(root, cleanSymbol);

            String symbolOut = root.path("symbol").asText(cleanSymbol);
            BigDecimal price = parseBigDecimal(root.path("close").asText(null));
            if (price == null) {
                price = parseBigDecimal(root.path("price").asText(null));
            }
            if (price == null) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No forex price found for symbol: " + cleanSymbol);
            }

            BigDecimal change = parseBigDecimal(root.path("change").asText(null));
            String changePercent = formatChangePercent(root.path("percent_change").asText(null), change);
            Long timestamp = parseLong(root.path("timestamp").asText(null));

            return new MarketPriceDto(symbolOut, price, change, changePercent, timestamp);

        } catch (ResponseStatusException e) {
            throw e;
        } catch (RestClientException e) {
            log.error("Network error communicating with Twelve Data: {}", e.getMessage());
            throw new ResponseStatusException(HttpStatus.GATEWAY_TIMEOUT, "Twelve Data provider request timed out or unavailable");
        } catch (Exception e) {
            log.error("Unexpected error processing Twelve Data forex price: {}", e.getMessage());
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Error parsing Twelve Data forex response");
        }
    }

    /**
     * Fetch real-time Crypto price from Twelve Data
     */
    public MarketPriceDto getCryptoPrice(String symbol) {
        if (symbol == null || symbol.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Symbol parameter is required");
        }

        String cleanSymbol = symbol.trim().toUpperCase();
        String url = String.format("%s/quote?symbol=%s&apikey=%s", baseUrl, cleanSymbol, apiKey);

        try {
            log.info("Fetching Twelve Data crypto quote for symbol: {}", cleanSymbol);
            ResponseEntity<String> response = restTemplate.getForEntity(url, String.class);

            if (response.getBody() == null || response.getBody().trim().isEmpty()) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Empty response from Twelve Data API");
            }

            JsonNode root = objectMapper.readTree(response.getBody());
            checkTwelveDataError(root, cleanSymbol);

            String symbolOut = root.path("symbol").asText(cleanSymbol);
            BigDecimal price = parseBigDecimal(root.path("close").asText(null));
            if (price == null) {
                price = parseBigDecimal(root.path("price").asText(null));
            }
            if (price == null) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No crypto price found for symbol: " + cleanSymbol);
            }

            BigDecimal change = parseBigDecimal(root.path("change").asText(null));
            String changePercent = formatChangePercent(root.path("percent_change").asText(null), change);
            Long timestamp = parseLong(root.path("timestamp").asText(null));

            return new MarketPriceDto(symbolOut, price, change, changePercent, timestamp);

        } catch (ResponseStatusException e) {
            throw e;
        } catch (RestClientException e) {
            log.error("Network error communicating with Twelve Data: {}", e.getMessage());
            throw new ResponseStatusException(HttpStatus.GATEWAY_TIMEOUT, "Twelve Data provider request timed out or unavailable");
        } catch (Exception e) {
            log.error("Unexpected error processing Twelve Data crypto price: {}", e.getMessage());
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Error parsing Twelve Data crypto response");
        }
    }

    /**
     * Fetch real-time market quote from Twelve Data
     */
    public StockQuoteDto getQuote(String symbol) {
        if (symbol == null || symbol.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Symbol parameter is required");
        }

        String cleanSymbol = symbol.trim().toUpperCase();
        String url = String.format("%s/quote?symbol=%s&apikey=%s", baseUrl, cleanSymbol, apiKey);

        try {
            log.info("Fetching Twelve Data quote for symbol: {}", cleanSymbol);
            ResponseEntity<String> response = restTemplate.getForEntity(url, String.class);

            if (response.getBody() == null || response.getBody().trim().isEmpty()) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Empty response from Twelve Data API");
            }

            JsonNode root = objectMapper.readTree(response.getBody());
            checkTwelveDataError(root, cleanSymbol);

            String symbolOut = root.path("symbol").asText(cleanSymbol);
            String name = root.path("name").asText(null);
            BigDecimal price = parseBigDecimal(root.path("close").asText(null));
            if (price == null) {
                price = parseBigDecimal(root.path("price").asText(null));
            }
            if (price == null) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No market quote found for symbol: " + cleanSymbol);
            }

            BigDecimal open = parseBigDecimal(root.path("open").asText(null));
            BigDecimal high = parseBigDecimal(root.path("high").asText(null));
            BigDecimal low = parseBigDecimal(root.path("low").asText(null));
            BigDecimal previousClose = parseBigDecimal(root.path("previous_close").asText(null));
            BigDecimal change = parseBigDecimal(root.path("change").asText(null));
            String changePercent = formatChangePercent(root.path("percent_change").asText(null), change);
            Long volume = parseLong(root.path("volume").asText(null));
            String latestTradingDay = root.path("datetime").asText(null);
            Long timestamp = parseLong(root.path("timestamp").asText(null));

            return new StockQuoteDto(
                    symbolOut,
                    name,
                    price,
                    change,
                    changePercent,
                    previousClose,
                    open,
                    high,
                    low,
                    volume,
                    latestTradingDay,
                    timestamp
            );

        } catch (ResponseStatusException e) {
            throw e;
        } catch (RestClientException e) {
            log.error("Network error communicating with Twelve Data: {}", e.getMessage());
            throw new ResponseStatusException(HttpStatus.GATEWAY_TIMEOUT, "Twelve Data provider request timed out or unavailable");
        } catch (Exception e) {
            log.error("Unexpected error processing Twelve Data quote: {}", e.getMessage());
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Error parsing Twelve Data quote response");
        }
    }

    /**
     * Search market symbols from Twelve Data
     */
    public StockSearchResponseDto searchSymbols(String keywords) {
        if (keywords == null || keywords.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Keywords parameter is required");
        }

        String cleanKeywords = keywords.trim();
        String url = String.format("%s/symbol_search?symbol=%s&apikey=%s", baseUrl, cleanKeywords, apiKey);

        try {
            log.info("Searching Twelve Data symbols for keywords: {}", cleanKeywords);
            ResponseEntity<String> response = restTemplate.getForEntity(url, String.class);

            if (response.getBody() == null || response.getBody().trim().isEmpty()) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Empty response from Twelve Data API");
            }

            JsonNode root = objectMapper.readTree(response.getBody());
            checkTwelveDataError(root, cleanKeywords);

            JsonNode dataNode = root.path("data");
            List<StockSearchItemDto> bestMatches = new ArrayList<>();

            if (dataNode != null && dataNode.isArray()) {
                for (JsonNode item : dataNode) {
                    bestMatches.add(new StockSearchItemDto(
                            item.path("symbol").asText(null),
                            item.path("instrument_name").asText(null),
                            item.path("type").asText(null),
                            item.path("country").asText(null),
                            item.path("currency").asText(null),
                            null
                    ));
                }
            }

            return new StockSearchResponseDto(bestMatches, cleanKeywords);

        } catch (ResponseStatusException e) {
            throw e;
        } catch (RestClientException e) {
            log.error("Network error communicating with Twelve Data: {}", e.getMessage());
            throw new ResponseStatusException(HttpStatus.GATEWAY_TIMEOUT, "Twelve Data provider request timed out or unavailable");
        } catch (Exception e) {
            log.error("Unexpected error searching Twelve Data symbols: {}", e.getMessage());
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Error parsing symbol search response");
        }
    }

    private void checkTwelveDataError(JsonNode root, String query) {
        if (root.has("status") && "error".equalsIgnoreCase(root.path("status").asText())) {
            int code = root.path("code").asInt(400);
            String message = root.path("message").asText("Unknown error from Twelve Data");
            log.warn("Twelve Data API returned error (code {}): {}", code, message);

            if (code == 429 || message.toLowerCase().contains("api limit") || message.toLowerCase().contains("rate limit")) {
                throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Twelve Data API rate limit reached. Please try again shortly.");
            }
            if (code == 404 || message.toLowerCase().contains("not found") || message.toLowerCase().contains("cannot be found")) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No market data found for: " + query);
            }
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Twelve Data API error: " + message);
        }

        if (root.has("code") && root.path("code").asInt() == 429) {
            String message = root.path("message").asText("Twelve Data rate limit reached");
            log.warn("Twelve Data API rate limit: {}", message);
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Twelve Data API rate limit reached. Please try again shortly.");
        }
    }

    private String formatChangePercent(String val, BigDecimal change) {
        if (val == null || val.trim().isEmpty() || "null".equalsIgnoreCase(val.trim())) {
            return null;
        }
        String clean = val.trim();
        if (clean.endsWith("%")) {
            clean = clean.substring(0, clean.length() - 1).trim();
        }
        try {
            BigDecimal num = new BigDecimal(clean);
            String formatted = String.format("%.2f%%", num);
            if (num.compareTo(BigDecimal.ZERO) > 0 && !formatted.startsWith("+")) {
                formatted = "+" + formatted;
            }
            return formatted;
        } catch (Exception e) {
            return clean.endsWith("%") ? clean : clean + "%";
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
}
