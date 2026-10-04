package com.portfolio.websocket;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.portfolio.dto.market.MarketTickDto;
import com.portfolio.dto.market.StockQuoteDto;
import com.portfolio.service.MarketDataService;
import com.portfolio.service.UpstoxService;
import com.portfolio.service.twelvedata.TwelveDataWebSocketFeeder;
import com.portfolio.service.upstox.UpstoxWebSocketFeeder;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArraySet;

/**
 * WebSocket handler that streams real-time market data ticks from providers (Upstox & Twelve Data)
 * to Angular clients securely through Spring Boot.
 */
@Component
public class MarketFeedWebSocketHandler extends TextWebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(MarketFeedWebSocketHandler.class);

    private final UpstoxWebSocketFeeder upstoxWebSocketFeeder;
    private final TwelveDataWebSocketFeeder twelveDataWebSocketFeeder;
    private final UpstoxService upstoxService;
    private final MarketDataService marketDataService;
    private final ObjectMapper objectMapper;

    // Session -> Subscribed Symbols
    private final Map<String, Set<String>> sessionSubscriptions = new ConcurrentHashMap<>();
    // SessionId -> WebSocketSession
    private final Map<String, WebSocketSession> activeSessions = new ConcurrentHashMap<>();

    public MarketFeedWebSocketHandler(UpstoxWebSocketFeeder upstoxWebSocketFeeder,
                                      TwelveDataWebSocketFeeder twelveDataWebSocketFeeder,
                                      UpstoxService upstoxService,
                                      MarketDataService marketDataService,
                                      ObjectMapper objectMapper) {
        this.upstoxWebSocketFeeder = upstoxWebSocketFeeder;
        this.twelveDataWebSocketFeeder = twelveDataWebSocketFeeder;
        this.upstoxService = upstoxService;
        this.marketDataService = marketDataService;
        this.objectMapper = objectMapper;
    }

    @PostConstruct
    public void init() {
        upstoxWebSocketFeeder.addTickListener(this::broadcastTick);
        twelveDataWebSocketFeeder.addTickListener(this::broadcastTick);
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        activeSessions.put(session.getId(), session);
        sessionSubscriptions.put(session.getId(), new CopyOnWriteArraySet<>());
        log.info("Client connected to Market Feed WebSocket: session={}", session.getId());

        boolean upstoxConnected = upstoxService.getAuthStatus().connected();
        sendToSession(session, MarketTickDto.status("CONNECTED", "Market Feed WebSocket connected", true, "Spring Boot Gateway"));
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        try {
            JsonNode root = objectMapper.readTree(message.getPayload());
            String action = root.path("action").asText("subscribe");
            String symbol = root.path("symbol").asText(null);

            if ("ping".equalsIgnoreCase(action)) {
                sendToSession(session, Map.of("type", "PONG", "timestamp", System.currentTimeMillis()));
                return;
            }

            if (symbol == null || symbol.trim().isEmpty()) {
                return;
            }

            String cleanSymbol = symbol.trim().toUpperCase(Locale.ROOT);

            if ("subscribe".equalsIgnoreCase(action)) {
                subscribeSession(session, cleanSymbol);
            } else if ("unsubscribe".equalsIgnoreCase(action)) {
                unsubscribeSession(session, cleanSymbol);
            }

        } catch (Exception e) {
            log.warn("Error processing WebSocket message from {}: {}", session.getId(), e.getMessage());
        }
    }

    private void subscribeSession(WebSocketSession session, String symbol) {
        Set<String> subs = sessionSubscriptions.get(session.getId());
        if (subs != null) {
            subs.add(symbol);
        }

        log.info("Client {} subscribed to symbol: {}", session.getId(), symbol);

        boolean isIndian = upstoxService.isIndianSymbol(symbol);

        // 1. Dispatch dynamic subscription to appropriate backend provider feeder
        if (isIndian) {
            String instrumentKey = upstoxService.resolveInstrumentKey(symbol);
            upstoxWebSocketFeeder.subscribeInstrument(instrumentKey);

            if (!upstoxService.getAuthStatus().connected()) {
                sendToSession(session, MarketTickDto.status("DATA_UNAVAILABLE", "Upstox WebSocket streaming not authenticated. Login via Upstox to enable live feed.", false, "Upstox", symbol));
            }
        } else {
            twelveDataWebSocketFeeder.subscribeSymbol(symbol);
            if (!twelveDataWebSocketFeeder.isStreamingSupported()) {
                sendToSession(session, MarketTickDto.status("DATA_UNAVAILABLE", "Twelve Data WebSocket streaming unsupported for current plan.", false, "Twelve Data", symbol));
            }
        }

        // 2. Fetch real initial quote from provider
        try {
            StockQuoteDto initialQuote = null;
            if (isIndian && upstoxService.getAuthStatus().connected()) {
                initialQuote = upstoxService.getQuote(symbol);
            } else {
                initialQuote = marketDataService.getQuote(symbol);
            }

            if (initialQuote != null && initialQuote.price() != null) {
                MarketTickDto initialTick = MarketTickDto.tick(
                        symbol,
                        isIndian ? upstoxService.resolveInstrumentKey(symbol) : symbol,
                        initialQuote.price(),
                        initialQuote.open() != null ? initialQuote.open() : initialQuote.price(),
                        initialQuote.high() != null ? initialQuote.high() : initialQuote.price(),
                        initialQuote.low() != null ? initialQuote.low() : initialQuote.price(),
                        initialQuote.price(),
                        initialQuote.volume(),
                        initialQuote.change(),
                        initialQuote.changePercent(),
                        initialQuote.timestamp() != null ? initialQuote.timestamp() : System.currentTimeMillis(),
                        isIndian ? "Upstox" : "Twelve Data"
                );
                sendToSession(session, initialTick);
            }
        } catch (Exception e) {
            log.debug("Could not fetch immediate initial quote for {}: {}", symbol, e.getMessage());
            sendToSession(session, MarketTickDto.status("DATA_UNAVAILABLE", "Live quote temporarily unavailable: " + e.getMessage(), false, isIndian ? "Upstox" : "Twelve Data", symbol));
        }
    }

    private void unsubscribeSession(WebSocketSession session, String symbol) {
        Set<String> subs = sessionSubscriptions.get(session.getId());
        if (subs != null) {
            subs.remove(symbol);
        }
        log.info("Client {} unsubscribed from symbol: {}", session.getId(), symbol);

        // Check if any other session is still subscribed to this symbol
        boolean stillSubscribed = false;
        for (Set<String> activeSubs : sessionSubscriptions.values()) {
            if (activeSubs.contains(symbol)) {
                stillSubscribed = true;
                break;
            }
        }

        if (!stillSubscribed) {
            if (upstoxService.isIndianSymbol(symbol)) {
                String instrumentKey = upstoxService.resolveInstrumentKey(symbol);
                upstoxWebSocketFeeder.unsubscribeInstrument(instrumentKey);
            } else {
                twelveDataWebSocketFeeder.unsubscribeSymbol(symbol);
            }
        }
    }

    public void broadcastTick(MarketTickDto tick) {
        if (tick == null) return;

        for (Map.Entry<String, Set<String>> entry : sessionSubscriptions.entrySet()) {
            String sessionId = entry.getKey();
            Set<String> subs = entry.getValue();
            WebSocketSession session = activeSessions.get(sessionId);

            if (session != null && session.isOpen()) {
                // If it's a general status message, send it to all active sessions
                if ("STATUS".equals(tick.type()) && tick.symbol() == null) {
                    sendToSession(session, tick);
                    continue;
                }

                // If symbol-specific tick or status, check subscription match
                boolean matches = false;
                for (String subSymbol : subs) {
                    if (isMatchingSymbol(subSymbol, tick)) {
                        matches = true;
                        break;
                    }
                }

                if (matches) {
                    sendToSession(session, tick);
                }
            }
        }
    }

    private boolean isMatchingSymbol(String userSymbol, MarketTickDto tick) {
        if (userSymbol == null || tick == null) return false;
        String u = userSymbol.toUpperCase(Locale.ROOT);
        if (tick.symbol() != null) {
            String ts = tick.symbol().toUpperCase(Locale.ROOT);
            if (u.equalsIgnoreCase(ts) || u.replace(" ", "").equalsIgnoreCase(ts.replace(" ", ""))) {
                return true;
            }
        }
        if (tick.instrumentKey() != null) {
            String ik = tick.instrumentKey().toUpperCase(Locale.ROOT);
            if (ik.contains(u) || u.contains(ik) || ik.contains(u.replace(" ", ""))) {
                return true;
            }
            String resolved = upstoxService.resolveInstrumentKey(u);
            if (resolved.equalsIgnoreCase(ik)) {
                return true;
            }
        }
        return false;
    }

    private void sendToSession(WebSocketSession session, Object payload) {
        if (session == null || !session.isOpen()) return;
        try {
            String json = objectMapper.writeValueAsString(payload);
            synchronized (session) {
                session.sendMessage(new TextMessage(json));
            }
        } catch (IOException e) {
            log.debug("Failed to send message to session {}: {}", session.getId(), e.getMessage());
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        Set<String> subs = sessionSubscriptions.remove(session.getId());
        activeSessions.remove(session.getId());
        log.info("Client disconnected from Market Feed WebSocket: session={}, status={}", session.getId(), status);

        // Clean up unreferenced subscriptions
        if (subs != null) {
            for (String symbol : subs) {
                boolean stillSubscribed = false;
                for (Set<String> activeSubs : sessionSubscriptions.values()) {
                    if (activeSubs.contains(symbol)) {
                        stillSubscribed = true;
                        break;
                    }
                }
                if (!stillSubscribed) {
                    if (upstoxService.isIndianSymbol(symbol)) {
                        String instrumentKey = upstoxService.resolveInstrumentKey(symbol);
                        upstoxWebSocketFeeder.unsubscribeInstrument(instrumentKey);
                    } else {
                        twelveDataWebSocketFeeder.unsubscribeSymbol(symbol);
                    }
                }
            }
        }
    }
}
