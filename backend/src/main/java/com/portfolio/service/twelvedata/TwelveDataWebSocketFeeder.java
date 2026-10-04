package com.portfolio.service.twelvedata;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.portfolio.dto.market.MarketTickDto;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Consumer;

/**
 * Manages the backend-to-Twelve-Data WebSocket connection for US Stocks, Forex, and Crypto streaming.
 * Connects securely from Spring Boot to Twelve Data WebSocket endpoint and distributes real-time market ticks.
 */
@Service
public class TwelveDataWebSocketFeeder {

    private static final Logger log = LoggerFactory.getLogger(TwelveDataWebSocketFeeder.class);

    private final ObjectMapper objectMapper;

    @Value("${twelvedata.api.key:demo}")
    private String apiKey;

    @Value("${twelvedata.ws.base-url:wss://ws.twelvedata.com/v1/quotes/price}")
    private String wsBaseUrl;

    private final Set<String> activeSubscriptions = Collections.synchronizedSet(new HashSet<>());
    private final List<Consumer<MarketTickDto>> tickListeners = new CopyOnWriteArrayList<>();

    private WebSocketSession session;
    private final AtomicBoolean isConnecting = new AtomicBoolean(false);
    private final AtomicBoolean streamingSupported = new AtomicBoolean(true);
    private final AtomicInteger backoffSeconds = new AtomicInteger(3);
    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();
    private ScheduledFuture<?> heartbeatFuture;

    public TwelveDataWebSocketFeeder(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public void addTickListener(Consumer<MarketTickDto> listener) {
        if (listener != null && !tickListeners.contains(listener)) {
            tickListeners.add(listener);
        }
    }

    public void removeTickListener(Consumer<MarketTickDto> listener) {
        tickListeners.remove(listener);
    }

    public synchronized void subscribeSymbol(String symbol) {
        if (symbol == null || symbol.trim().isEmpty()) return;
        String cleanSymbol = symbol.trim().toUpperCase(Locale.ROOT);

        activeSubscriptions.add(cleanSymbol);

        if (isConnected()) {
            sendSubscriptionMessage(List.of(cleanSymbol));
        } else {
            connect();
        }
    }

    public synchronized void unsubscribeSymbol(String symbol) {
        if (symbol == null) return;
        String cleanSymbol = symbol.trim().toUpperCase(Locale.ROOT);
        activeSubscriptions.remove(cleanSymbol);

        if (isConnected()) {
            sendUnsubscriptionMessage(List.of(cleanSymbol));
        }
    }

    public boolean isConnected() {
        return session != null && session.isOpen();
    }

    public boolean isStreamingSupported() {
        return streamingSupported.get();
    }

    public synchronized void connect() {
        if (isConnected() || isConnecting.get()) {
            return;
        }

        String key = (apiKey != null && !apiKey.trim().isEmpty()) ? apiKey.trim() : "demo";
        if ("demo".equalsIgnoreCase(key)) {
            log.info("[TwelveData WS] API key is 'demo' / unset. WebSocket streaming requires a valid API key.");
        }

        isConnecting.set(true);

        scheduler.execute(() -> {
            try {
                String fullWsUrl = String.format("%s?apikey=%s", wsBaseUrl != null ? wsBaseUrl : "wss://ws.twelvedata.com/v1/quotes/price", key);
                log.info("[TwelveData WS] Connecting to Twelve Data WebSocket at: {}", fullWsUrl.replaceAll("apikey=[^&]+", "apikey=***"));

                StandardWebSocketClient client = new StandardWebSocketClient();
                client.execute(new TwelveDataTextHandler(), fullWsUrl)
                        .thenAccept(wsSession -> {
                            this.session = wsSession;
                            this.isConnecting.set(false);
                            this.backoffSeconds.set(3); // Reset backoff on successful connect
                            log.info("[TwelveData WS] Connected successfully to Twelve Data WebSocket endpoint");

                            startHeartbeat();

                            if (!activeSubscriptions.isEmpty()) {
                                sendSubscriptionMessage(new ArrayList<>(activeSubscriptions));
                            }
                        })
                        .exceptionally(ex -> {
                            this.isConnecting.set(false);
                            log.warn("[TwelveData WS] Failed to connect to Twelve Data WebSocket: {}", ex.getMessage());
                            notifyStreamingUnavailable(null, "Failed to connect to Twelve Data WebSocket: " + ex.getMessage());
                            scheduleReconnect();
                            return null;
                        });

            } catch (Exception e) {
                isConnecting.set(false);
                log.warn("[TwelveData WS] Error initiating Twelve Data WebSocket connection: {}", e.getMessage());
                notifyStreamingUnavailable(null, "Twelve Data WebSocket error: " + e.getMessage());
                scheduleReconnect();
            }
        });
    }

    private void sendSubscriptionMessage(List<String> symbols) {
        if (!isConnected() || symbols == null || symbols.isEmpty()) {
            return;
        }

        try {
            String symbolsParam = String.join(",", symbols);
            Map<String, Object> payload = Map.of(
                    "action", "subscribe",
                    "params", Map.of("symbols", symbolsParam)
            );

            String json = objectMapper.writeValueAsString(payload);
            session.sendMessage(new TextMessage(json));
            log.info("[TwelveData WS] Sent subscription request for symbols: {}", symbolsParam);
        } catch (Exception e) {
            log.warn("[TwelveData WS] Error sending Twelve Data subscription: {}", e.getMessage());
        }
    }

    private void sendUnsubscriptionMessage(List<String> symbols) {
        if (!isConnected() || symbols == null || symbols.isEmpty()) {
            return;
        }

        try {
            String symbolsParam = String.join(",", symbols);
            Map<String, Object> payload = Map.of(
                    "action", "unsubscribe",
                    "params", Map.of("symbols", symbolsParam)
            );

            String json = objectMapper.writeValueAsString(payload);
            session.sendMessage(new TextMessage(json));
            log.info("[TwelveData WS] Sent unsubscription request for symbols: {}", symbolsParam);
        } catch (Exception e) {
            log.warn("[TwelveData WS] Error sending Twelve Data unsubscription: {}", e.getMessage());
        }
    }

    private void startHeartbeat() {
        stopHeartbeat();
        heartbeatFuture = scheduler.scheduleAtFixedRate(() -> {
            if (isConnected()) {
                try {
                    String ping = objectMapper.writeValueAsString(Map.of("action", "ping"));
                    session.sendMessage(new TextMessage(ping));
                } catch (Exception e) {
                    log.debug("[TwelveData WS] Ping failed: {}", e.getMessage());
                }
            }
        }, 15, 20, TimeUnit.SECONDS);
    }

    private void stopHeartbeat() {
        if (heartbeatFuture != null) {
            heartbeatFuture.cancel(true);
            heartbeatFuture = null;
        }
    }

    private void scheduleReconnect() {
        if (activeSubscriptions.isEmpty()) {
            return;
        }
        int delay = backoffSeconds.getAndUpdate(prev -> Math.min(prev * 2, 60));
        log.info("[TwelveData WS] Scheduling Twelve Data WebSocket reconnect in {} seconds...", delay);
        scheduler.schedule(() -> {
            if (!isConnected() && !activeSubscriptions.isEmpty()) {
                connect();
            }
        }, delay, TimeUnit.SECONDS);
    }

    private void notifyStreamingUnavailable(String symbol, String message) {
        MarketTickDto statusTick = MarketTickDto.status("DATA_UNAVAILABLE", message, false, "Twelve Data", symbol);
        for (Consumer<MarketTickDto> listener : tickListeners) {
            try {
                listener.accept(statusTick);
            } catch (Exception ignored) {}
        }
    }

    private class TwelveDataTextHandler extends TextWebSocketHandler {

        @Override
        public void afterConnectionEstablished(WebSocketSession wsSession) {
            log.info("[TwelveData WS] Session established: id={}", wsSession.getId());
        }

        @Override
        protected void handleTextMessage(WebSocketSession wsSession, TextMessage message) {
            try {
                JsonNode root = objectMapper.readTree(message.getPayload());
                String event = root.path("event").asText("");

                if ("price".equalsIgnoreCase(event)) {
                    String symbol = root.path("symbol").asText(null);
                    BigDecimal price = root.has("price") ? new BigDecimal(root.path("price").asText()) : null;
                    Long timestamp = root.has("timestamp") ? root.path("timestamp").asLong() * 1000L : System.currentTimeMillis();
                    Long volume = root.has("day_volume") ? root.path("day_volume").asLong() : null;

                    if (symbol != null && price != null) {
                        log.info("[TwelveData WS] Real tick received: symbol={}, price={}, timestamp={}, exchange={}",
                                symbol, price, timestamp, root.path("exchange").asText("N/A"));

                        MarketTickDto tick = MarketTickDto.tick(
                                symbol,
                                symbol,
                                price,
                                price,
                                price,
                                price,
                                price,
                                volume,
                                null,
                                null,
                                timestamp,
                                "Twelve Data"
                        );

                        for (Consumer<MarketTickDto> listener : tickListeners) {
                            try {
                                listener.accept(tick);
                            } catch (Exception e) {
                                log.debug("[TwelveData WS] Error in tick listener: {}", e.getMessage());
                            }
                        }
                    }
                } else if ("subscribe-status".equalsIgnoreCase(event)) {
                    String status = root.path("status").asText("");
                    log.info("[TwelveData WS] Subscription response: event={}, status={}, success={}, fails={}",
                            event, status, root.path("success"), root.path("fails"));

                    if ("ok".equalsIgnoreCase(status)) {
                        streamingSupported.set(true);
                    } else if ("error".equalsIgnoreCase(status)) {
                        String msg = root.path("message").asText("Twelve Data subscription failed");
                        log.warn("[TwelveData WS] Subscription error response: {}", msg);
                        streamingSupported.set(false);
                        notifyStreamingUnavailable(null, msg);
                    }
                } else if ("status".equalsIgnoreCase(event)) {
                    String status = root.path("status").asText("");
                    String msg = root.path("message").asText("");

                    if ("error".equalsIgnoreCase(status)) {
                        log.warn("[TwelveData WS] Provider error event: {}", msg);
                        streamingSupported.set(false);
                        notifyStreamingUnavailable(null, msg);
                    } else if ("ok".equalsIgnoreCase(status)) {
                        streamingSupported.set(true);
                    }
                } else if ("pong".equalsIgnoreCase(event)) {
                    log.debug("[TwelveData WS] Received pong heartbeat");
                }
            } catch (Exception e) {
                log.debug("[TwelveData WS] Error parsing message: {}", e.getMessage());
            }
        }

        @Override
        public void handleTransportError(WebSocketSession wsSession, Throwable exception) {
            log.warn("[TwelveData WS] Transport error: {}", exception.getMessage());
        }

        @Override
        public void afterConnectionClosed(WebSocketSession wsSession, CloseStatus status) {
            log.info("[TwelveData WS] Disconnected: code={}, reason={}", status.getCode(), status.getReason());
            session = null;
            stopHeartbeat();
            scheduleReconnect();
        }
    }

    @PreDestroy
    public void cleanup() {
        try {
            stopHeartbeat();
            if (session != null && session.isOpen()) {
                session.close();
            }
            scheduler.shutdownNow();
        } catch (Exception ignored) {}
    }
}
