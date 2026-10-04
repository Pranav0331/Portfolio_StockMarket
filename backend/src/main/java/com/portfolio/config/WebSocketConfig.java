package com.portfolio.config;

import com.portfolio.websocket.MarketFeedWebSocketHandler;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final MarketFeedWebSocketHandler marketFeedWebSocketHandler;

    public WebSocketConfig(MarketFeedWebSocketHandler marketFeedWebSocketHandler) {
        this.marketFeedWebSocketHandler = marketFeedWebSocketHandler;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(marketFeedWebSocketHandler, "/ws/market-feed")
                .setAllowedOriginPatterns("*");
    }
}
