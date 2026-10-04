package com.portfolio.service.upstox;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.portfolio.dto.market.MarketTickDto;
import com.portfolio.service.UpstoxService;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.socket.BinaryMessage;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.handler.BinaryWebSocketHandler;

import java.net.URI;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Consumer;
import org.springframework.web.socket.WebSocketHttpHeaders;

/**
 * Manages the backend-to-Upstox WebSocket connection for Market Data Feed V3.
 * Connects securely from Spring Boot to Upstox and distributes real-time market ticks.
 */
@Service
public class UpstoxWebSocketFeeder {

    private static final Logger log = LoggerFactory.getLogger(UpstoxWebSocketFeeder.class);

    private final UpstoxService upstoxService;
    private final UpstoxProtobufDecoder protobufDecoder;
    private final ObjectMapper objectMapper;
    private final RestTemplate restTemplate;

    @Value("${upstox.api.base-url:https://api.upstox.com/v2}")
    private String baseUrl;

    private final Set<String> activeInstrumentSubscriptions = Collections.synchronizedSet(new HashSet<>());
    private final List<Consumer<MarketTickDto>> tickListeners = new CopyOnWriteArrayList<>();

    private WebSocketSession upstoxSession;
    private final AtomicBoolean isConnecting = new AtomicBoolean(false);
    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();

    public UpstoxWebSocketFeeder(UpstoxService upstoxService,
                                 UpstoxProtobufDecoder protobufDecoder,
                                 ObjectMapper objectMapper) {
        this.upstoxService = upstoxService;
        this.protobufDecoder = protobufDecoder;
        this.objectMapper = objectMapper;
        this.restTemplate = new RestTemplate();
    }

    public void addTickListener(Consumer<MarketTickDto> listener) {
        if (listener != null && !tickListeners.contains(listener)) {
            tickListeners.add(listener);
        }
    }

    public void removeTickListener(Consumer<MarketTickDto> listener) {
        tickListeners.remove(listener);
    }

    /**
     * Subscribe to real-time market ticks for an instrument key
     */
    public synchronized void subscribeInstrument(String instrumentKey) {
        if (instrumentKey == null || instrumentKey.trim().isEmpty()) return;
        String cleanKey = instrumentKey.trim();

        activeInstrumentSubscriptions.add(cleanKey);

        if (isConnected()) {
            sendSubscriptionMessage(List.of(cleanKey));
        } else {
            connectToUpstoxWebSocket();
        }
    }

    /**
     * Unsubscribe from an instrument key if no longer needed
     */
    public synchronized void unsubscribeInstrument(String instrumentKey) {
        if (instrumentKey == null) return;
        activeInstrumentSubscriptions.remove(instrumentKey.trim());
    }

    public boolean isConnected() {
        return upstoxSession != null && upstoxSession.isOpen();
    }

    /**
     * Authorize and connect to Upstox Market Data Feed V3 WebSocket
     */
    public synchronized void connectToUpstoxWebSocket() {
        if (isConnected() || isConnecting.get()) {
            return;
        }

        if (!upstoxService.getAuthStatus().connected()) {
            log.debug("Cannot connect to Upstox WebSocket: Not authenticated yet");
            return;
        }

        isConnecting.set(true);

        scheduler.execute(() -> {
            try {
                String token = upstoxService.getValidAccessToken();
                if (token == null || token.trim().isEmpty()) {
                    isConnecting.set(false);
                    return;
                }

                // 1. Call Upstox authorization endpoint to get the WebSocket redirect URL
                String authUrl = baseUrl + "/feed/market-data-feed/authorize";
                HttpHeaders headers = new HttpHeaders();
                headers.setBearerAuth(token);
                headers.setAccept(List.of(MediaType.APPLICATION_JSON));
                HttpEntity<Void> entity = new HttpEntity<>(headers);

                log.info("Requesting Upstox WebSocket V3 authorized redirect URI from: {}", authUrl);
                ResponseEntity<String> response = restTemplate.exchange(authUrl, HttpMethod.GET, entity, String.class);

                if (response.getBody() == null || response.getBody().trim().isEmpty()) {
                    log.warn("Received empty response from Upstox feed authorize endpoint");
                    isConnecting.set(false);
                    return;
                }

                JsonNode root = objectMapper.readTree(response.getBody());
                String authorizedUri = root.path("data").path("authorizedRedirectUri").asText(null);

                if (authorizedUri == null || authorizedUri.trim().isEmpty()) {
                    log.warn("Upstox authorizedRedirectUri missing in response: {}", response.getBody());
                    isConnecting.set(false);
                    return;
                }

                log.info("Connecting to Upstox Market Data Feed V3 WebSocket at: {}", authorizedUri);

                StandardWebSocketClient client = new StandardWebSocketClient();
                client.execute(new UpstoxBinaryHandler(), new WebSocketHttpHeaders(headers), URI.create(authorizedUri))
                        .thenAccept(session -> {
                            this.upstoxSession = session;
                            isConnecting.set(false);
                            log.info("Successfully connected to Upstox Market Data Feed V3 WebSocket");

                            // Re-subscribe all active instruments
                            if (!activeInstrumentSubscriptions.isEmpty()) {
                                sendSubscriptionMessage(new ArrayList<>(activeInstrumentSubscriptions));
                            }
                        })
                        .exceptionally(ex -> {
                            isConnecting.set(false);
                            log.warn("Failed to connect to Upstox WebSocket: {}", ex.getMessage());
                            scheduleReconnect();
                            return null;
                        });

            } catch (Exception e) {
                isConnecting.set(false);
                log.warn("Error during Upstox WebSocket connection initiation: {}", e.getMessage());
                scheduleReconnect();
            }
        });
    }

    private void sendSubscriptionMessage(List<String> instrumentKeys) {
        if (!isConnected() || instrumentKeys == null || instrumentKeys.isEmpty()) {
            return;
        }

        try {
            Map<String, Object> subParams = Map.of(
                    "mode", "full",
                    "instrumentKeys", instrumentKeys
            );

            Map<String, Object> payload = Map.of(
                    "guid", UUID.randomUUID().toString(),
                    "method", "sub",
                    "params", subParams
            );

            String json = objectMapper.writeValueAsString(payload);
            upstoxSession.sendMessage(new TextMessage(json));
            log.info("Sent Upstox WebSocket subscription for instruments: {}", instrumentKeys);
        } catch (Exception e) {
            log.warn("Error sending Upstox subscription: {}", e.getMessage());
        }
    }

    private void scheduleReconnect() {
        scheduler.schedule(() -> {
            if (!isConnected() && !activeInstrumentSubscriptions.isEmpty()) {
                connectToUpstoxWebSocket();
            }
        }, 5, TimeUnit.SECONDS);
    }

    private String getAccessTokenSilently() {
        try {
            // Using quote reflection/getter or session status
            var status = upstoxService.getAuthStatus();
            if (status.connected()) {
                return status.userId(); // Placeholder to trigger valid access token flow
            }
        } catch (Exception ignored) {}
        return null;
    }

    private class UpstoxBinaryHandler extends BinaryWebSocketHandler {

        @Override
        public void afterConnectionEstablished(WebSocketSession session) {
            log.info("Upstox WebSocket session established: {}", session.getId());
        }

        @Override
        protected void handleBinaryMessage(WebSocketSession session, BinaryMessage message) {
            byte[] payload = message.getPayload().array();
            List<MarketTickDto> ticks = protobufDecoder.decode(payload);

            if (!ticks.isEmpty()) {
                for (MarketTickDto tick : ticks) {
                    for (Consumer<MarketTickDto> listener : tickListeners) {
                        try {
                            listener.accept(tick);
                        } catch (Exception e) {
                            log.debug("Tick listener error: {}", e.getMessage());
                        }
                    }
                }
            }
        }

        @Override
        public void handleTransportError(WebSocketSession session, Throwable exception) {
            log.warn("Upstox WebSocket transport error: {}", exception.getMessage());
        }

        @Override
        public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
            log.info("Upstox WebSocket disconnected: {}", status);
            upstoxSession = null;
            scheduleReconnect();
        }
    }

    @PreDestroy
    public void cleanup() {
        try {
            if (upstoxSession != null && upstoxSession.isOpen()) {
                upstoxSession.close();
            }
            scheduler.shutdownNow();
        } catch (Exception ignored) {}
    }
}
