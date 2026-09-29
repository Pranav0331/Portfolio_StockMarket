package com.portfolio.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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

    @Value("${alphavantage.api.key:demo}")
    private String apiKey;

    @Value("${alphavantage.api.base-url:https://www.alphavantage.co}")
    private String baseUrl;

    @org.springframework.beans.factory.annotation.Autowired
    public MarketDataService(RestTemplateBuilder restTemplateBuilder, ObjectMapper objectMapper,
                             @Value("${alphavantage.api.timeout-ms:10000}") int timeoutMs) {
        this.restTemplate = restTemplateBuilder
                .setConnectTimeout(Duration.ofMillis(timeoutMs))
                .setReadTimeout(Duration.ofMillis(timeoutMs))
                .build();
        this.objectMapper = objectMapper;
    }

    MarketDataService(RestTemplate restTemplate, ObjectMapper objectMapper) {
        this.restTemplate = restTemplate;
        this.objectMapper = objectMapper;
    }

    public StockQuoteDto getQuote(String symbol) {
        if (symbol == null || symbol.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Symbol parameter is required");
        }

        String cleanSymbol = symbol.trim().toUpperCase();
        String url = String.format("%s/query?function=GLOBAL_QUOTE&symbol=%s&apikey=%s", baseUrl, cleanSymbol, apiKey);

        try {
            log.info("Fetching real-time market quote for symbol: {}", cleanSymbol);
            ResponseEntity<String> response = restTemplate.getForEntity(url, String.class);

            if (response.getBody() == null || response.getBody().trim().isEmpty()) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Empty response from market data provider");
            }

            JsonNode root = objectMapper.readTree(response.getBody());

            checkRateLimitOrError(root);

            JsonNode quoteNode = root.get("Global Quote");
            if (quoteNode == null || quoteNode.isEmpty() || !quoteNode.has("01. symbol")) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No market quote found for symbol: " + cleanSymbol);
            }

            String symbolOut = quoteNode.path("01. symbol").asText(cleanSymbol);
            BigDecimal open = parseBigDecimal(quoteNode.path("02. open").asText(null));
            BigDecimal high = parseBigDecimal(quoteNode.path("03. high").asText(null));
            BigDecimal low = parseBigDecimal(quoteNode.path("04. low").asText(null));
            BigDecimal price = parseBigDecimal(quoteNode.path("05. price").asText(null));
            Long volume = parseLong(quoteNode.path("06. volume").asText(null));
            String latestTradingDay = quoteNode.path("07. latest trading day").asText(null);
            BigDecimal previousClose = parseBigDecimal(quoteNode.path("08. previous close").asText(null));
            BigDecimal change = parseBigDecimal(quoteNode.path("09. change").asText(null));
            String changePercent = quoteNode.path("10. change percent").asText(null);

            return new StockQuoteDto(
                    symbolOut,
                    null,
                    price,
                    change,
                    changePercent,
                    previousClose,
                    open,
                    high,
                    low,
                    volume,
                    latestTradingDay
            );

        } catch (ResponseStatusException e) {
            throw e;
        } catch (RestClientException e) {
            log.error("Network error communicating with Alpha Vantage: {}", e.getMessage());
            throw new ResponseStatusException(HttpStatus.GATEWAY_TIMEOUT, "Market data provider request timed out or unavailable");
        } catch (Exception e) {
            log.error("Unexpected error processing market quote: {}", e.getMessage());
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Error parsing market quote response");
        }
    }

    public StockSearchResponseDto searchSymbols(String keywords) {
        if (keywords == null || keywords.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Keywords parameter is required");
        }

        String cleanKeywords = keywords.trim();
        String url = String.format("%s/query?function=SYMBOL_SEARCH&keywords=%s&apikey=%s", baseUrl, cleanKeywords, apiKey);

        try {
            log.info("Searching market symbols for keywords: {}", cleanKeywords);
            ResponseEntity<String> response = restTemplate.getForEntity(url, String.class);

            if (response.getBody() == null || response.getBody().trim().isEmpty()) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Empty response from market data provider");
            }

            JsonNode root = objectMapper.readTree(response.getBody());

            checkRateLimitOrError(root);

            JsonNode matchesNode = root.get("bestMatches");
            List<StockSearchItemDto> bestMatches = new ArrayList<>();

            if (matchesNode != null && matchesNode.isArray()) {
                for (JsonNode match : matchesNode) {
                    bestMatches.add(new StockSearchItemDto(
                            match.path("1. symbol").asText(null),
                            match.path("2. name").asText(null),
                            match.path("3. type").asText(null),
                            match.path("4. region").asText(null),
                            match.path("8. currency").asText(null),
                            match.path("9. matchScore").asText(null)
                    ));
                }
            }

            return new StockSearchResponseDto(bestMatches, cleanKeywords);

        } catch (ResponseStatusException e) {
            throw e;
        } catch (RestClientException e) {
            log.error("Network error communicating with Alpha Vantage: {}", e.getMessage());
            throw new ResponseStatusException(HttpStatus.GATEWAY_TIMEOUT, "Market data provider request timed out or unavailable");
        } catch (Exception e) {
            log.error("Unexpected error searching market symbols: {}", e.getMessage());
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Error parsing symbol search response");
        }
    }

    private void checkRateLimitOrError(JsonNode root) {
        if (root.has("Note") || root.has("Information")) {
            String msg = root.has("Note") ? root.get("Note").asText() : root.get("Information").asText();
            log.warn("Alpha Vantage API rate limit / information returned: {}", msg);
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Alpha Vantage market data rate limit reached. Please try again shortly.");
        }
        if (root.has("Error Message")) {
            String errorMsg = root.get("Error Message").asText();
            log.warn("Alpha Vantage API returned error: {}", errorMsg);
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Market data provider error: " + errorMsg);
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
