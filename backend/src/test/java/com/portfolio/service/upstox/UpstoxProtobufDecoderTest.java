package com.portfolio.service.upstox;

import com.portfolio.dto.market.MarketTickDto;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class UpstoxProtobufDecoderTest {

    private UpstoxProtobufDecoder decoder;

    @BeforeEach
    void setUp() {
        decoder = new UpstoxProtobufDecoder();
    }

    @Test
    @DisplayName("Should handle empty and null byte buffers safely without exceptions")
    void testDecodeEmptyAndNull() {
        List<MarketTickDto> nullTicks = decoder.decode(null);
        assertNotNull(nullTicks);
        assertTrue(nullTicks.isEmpty());

        List<MarketTickDto> emptyTicks = decoder.decode(new byte[0]);
        assertNotNull(emptyTicks);
        assertTrue(emptyTicks.isEmpty());
    }

    @Test
    @DisplayName("Should decode synthesized Upstox Market Data Feed Protobuf LTPC packet")
    void testDecodeSyntheticFeed() throws IOException {
        // Construct a wire-compliant protobuf payload for FeedResponse with 1 feed map entry:
        // FeedResponse: field 2 (feeds map entry)
        // MapEntry: field 1 (string key = "NSE_EQ|INE002A01018"), field 2 (Feed message)
        // Feed message: field 1 (LTPC message)
        // LTPC message: field 1 (double ltp = 2950.50), field 2 (int64 ltt = 1728000000), field 4 (double cp = 2930.00)

        ByteArrayOutputStream ltpcStream = new ByteArrayOutputStream();
        // LTPC field 1 (tag 9 = (1 << 3) | 1 fixed64): ltp = 2950.50
        ltpcStream.write(9);
        writeFixed64(ltpcStream, Double.doubleToRawLongBits(2950.50));
        // LTPC field 2 (tag 16 = (2 << 3) | 0 varint): ltt = 1728000000
        ltpcStream.write(16);
        writeVarint(ltpcStream, 1728000000L);
        // LTPC field 4 (tag 33 = (4 << 3) | 1 fixed64): cp = 2930.00
        ltpcStream.write(33);
        writeFixed64(ltpcStream, Double.doubleToRawLongBits(2930.00));
        byte[] ltpcBytes = ltpcStream.toByteArray();

        // Feed message: field 1 (tag 10 = (1 << 3) | 2 length-delimited)
        ByteArrayOutputStream feedStream = new ByteArrayOutputStream();
        feedStream.write(10);
        writeVarint(feedStream, ltpcBytes.length);
        feedStream.write(ltpcBytes);
        byte[] feedBytes = feedStream.toByteArray();

        // MapEntry message: field 1 (key = "NSE_EQ|INE002A01018"), field 2 (Feed message)
        ByteArrayOutputStream mapEntryStream = new ByteArrayOutputStream();
        byte[] keyBytes = "NSE_EQ|INE002A01018".getBytes();
        mapEntryStream.write(10); // field 1 tag
        writeVarint(mapEntryStream, keyBytes.length);
        mapEntryStream.write(keyBytes);

        mapEntryStream.write(18); // field 2 tag (2 << 3 | 2)
        writeVarint(mapEntryStream, feedBytes.length);
        mapEntryStream.write(feedBytes);
        byte[] mapEntryBytes = mapEntryStream.toByteArray();

        // Root FeedResponse: field 2 (tag 18 = (2 << 3) | 2)
        ByteArrayOutputStream rootStream = new ByteArrayOutputStream();
        rootStream.write(18);
        writeVarint(rootStream, mapEntryBytes.length);
        rootStream.write(mapEntryBytes);
        byte[] rootBytes = rootStream.toByteArray();

        List<MarketTickDto> ticks = decoder.decode(rootBytes);
        assertNotNull(ticks);
        assertEquals(1, ticks.size());

        MarketTickDto tick = ticks.get(0);
        assertEquals("NSE_EQ|INE002A01018", tick.instrumentKey());
        assertEquals("2950.50", tick.price().toString());
        assertEquals("20.50", tick.change().toString());
        assertNotNull(tick.changePercent());
        assertTrue(tick.changePercent().contains("+0.70%"));
    }

    private void writeVarint(ByteArrayOutputStream out, long value) {
        while ((value & ~0x7FL) != 0) {
            out.write((int) ((value & 0x7F) | 0x80));
            value >>>= 7;
        }
        out.write((int) value);
    }

    private void writeFixed64(ByteArrayOutputStream out, long value) throws IOException {
        ByteBuffer buf = ByteBuffer.allocate(8).order(ByteOrder.LITTLE_ENDIAN);
        buf.putLong(value);
        out.write(buf.array());
    }
}
