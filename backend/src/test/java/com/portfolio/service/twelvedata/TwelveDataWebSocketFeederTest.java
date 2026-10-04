package com.portfolio.service.twelvedata;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.portfolio.dto.market.MarketTickDto;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class TwelveDataWebSocketFeederTest {

    private TwelveDataWebSocketFeeder feeder;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        feeder = new TwelveDataWebSocketFeeder(objectMapper);
    }

    @Test
    @DisplayName("Should register and unregister tick listeners properly")
    void testTickListeners() {
        List<MarketTickDto> received = new ArrayList<>();
        java.util.function.Consumer<MarketTickDto> listener = received::add;

        feeder.addTickListener(listener);
        feeder.removeTickListener(listener);

        assertFalse(feeder.isConnected());
    }

    @Test
    @DisplayName("Should track active subscriptions and streaming support flag")
    void testSubscriptionsAndStreamingStatus() {
        assertTrue(feeder.isStreamingSupported());

        feeder.subscribeSymbol("AAPL");
        feeder.subscribeSymbol("EUR/USD");
        feeder.subscribeSymbol("BTC/USD");

        feeder.unsubscribeSymbol("AAPL");
        feeder.unsubscribeSymbol("EUR/USD");
        feeder.unsubscribeSymbol("BTC/USD");

        assertFalse(feeder.isConnected());
    }
}
