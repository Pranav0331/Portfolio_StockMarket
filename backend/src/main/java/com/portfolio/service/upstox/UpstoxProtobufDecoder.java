package com.portfolio.service.upstox;

import com.google.protobuf.CodedInputStream;
import com.google.protobuf.WireFormat;
import com.portfolio.dto.market.MarketTickDto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;

/**
 * High-performance Protobuf Decoder for Upstox Market Data Feed V3.
 * Decodes binary stream packets without requiring protoc compilation.
 */
@Component
public class UpstoxProtobufDecoder {

    private static final Logger log = LoggerFactory.getLogger(UpstoxProtobufDecoder.class);

    public List<MarketTickDto> decode(byte[] data) {
        List<MarketTickDto> ticks = new ArrayList<>();
        if (data == null || data.length == 0) {
            return ticks;
        }

        try {
            CodedInputStream input = CodedInputStream.newInstance(data);
            while (!input.isAtEnd()) {
                int tag = input.readTag();
                if (tag == 0) break;

                int fieldNumber = WireFormat.getTagFieldNumber(tag);
                int wireType = WireFormat.getTagWireType(tag);

                if (fieldNumber == 2 && wireType == WireFormat.WIRETYPE_LENGTH_DELIMITED) {
                    // Field 2: map<string, Feed> feeds entry
                    int length = input.readRawVarint32();
                    int oldLimit = input.pushLimit(length);
                    MarketTickDto tick = parseMapEntry(input);
                    if (tick != null) {
                        ticks.add(tick);
                    }
                    input.popLimit(oldLimit);
                } else {
                    input.skipField(tag);
                }
            }
        } catch (Exception e) {
            log.debug("Error parsing Upstox Protobuf packet: {}", e.getMessage());
        }

        return ticks;
    }

    private MarketTickDto parseMapEntry(CodedInputStream input) {
        String key = null;
        RawFeedData feedData = null;

        try {
            while (!input.isAtEnd()) {
                int tag = input.readTag();
                if (tag == 0) break;

                int fieldNumber = WireFormat.getTagFieldNumber(tag);
                int wireType = WireFormat.getTagWireType(tag);

                if (fieldNumber == 1 && wireType == WireFormat.WIRETYPE_LENGTH_DELIMITED) {
                    key = input.readString();
                } else if (fieldNumber == 2 && wireType == WireFormat.WIRETYPE_LENGTH_DELIMITED) {
                    int length = input.readRawVarint32();
                    int oldLimit = input.pushLimit(length);
                    feedData = parseFeed(input);
                    input.popLimit(oldLimit);
                } else {
                    input.skipField(tag);
                }
            }
        } catch (Exception e) {
            log.trace("Error parsing feed map entry: {}", e.getMessage());
        }

        if (key != null && feedData != null && feedData.ltp > 0) {
            BigDecimal price = BigDecimal.valueOf(feedData.ltp).setScale(2, RoundingMode.HALF_UP);
            BigDecimal open = feedData.open > 0 ? BigDecimal.valueOf(feedData.open).setScale(2, RoundingMode.HALF_UP) : price;
            BigDecimal high = feedData.high > 0 ? BigDecimal.valueOf(feedData.high).setScale(2, RoundingMode.HALF_UP) : price;
            BigDecimal low = feedData.low > 0 ? BigDecimal.valueOf(feedData.low).setScale(2, RoundingMode.HALF_UP) : price;
            BigDecimal close = feedData.close > 0 ? BigDecimal.valueOf(feedData.close).setScale(2, RoundingMode.HALF_UP) : null;
            BigDecimal previousClose = feedData.cp > 0 ? BigDecimal.valueOf(feedData.cp).setScale(2, RoundingMode.HALF_UP) : close;

            BigDecimal change = null;
            String changePercent = null;
            if (previousClose != null && previousClose.compareTo(BigDecimal.ZERO) > 0) {
                change = price.subtract(previousClose).setScale(2, RoundingMode.HALF_UP);
                BigDecimal pct = change.divide(previousClose, 4, RoundingMode.HALF_UP).multiply(BigDecimal.valueOf(100));
                changePercent = (pct.compareTo(BigDecimal.ZERO) >= 0 ? "+" : "") + String.format("%.2f%%", pct);
            }

            long ts = feedData.ltt > 0 ? feedData.ltt : System.currentTimeMillis();
            if (ts < 100000000000L) { // Convert seconds to millis if needed
                ts *= 1000L;
            }

            String displaySymbol = extractSymbolFromKey(key);

            return MarketTickDto.tick(
                    displaySymbol,
                    key,
                    price,
                    open,
                    high,
                    low,
                    price,
                    feedData.volume > 0 ? feedData.volume : feedData.ltq,
                    change,
                    changePercent,
                    ts
            );
        }

        return null;
    }

    private RawFeedData parseFeed(CodedInputStream input) {
        RawFeedData data = new RawFeedData();

        try {
            while (!input.isAtEnd()) {
                int tag = input.readTag();
                if (tag == 0) break;

                int fieldNumber = WireFormat.getTagFieldNumber(tag);
                int wireType = WireFormat.getTagWireType(tag);

                if (fieldNumber == 1 && wireType == WireFormat.WIRETYPE_LENGTH_DELIMITED) {
                    // Field 1: LTPC ltpc
                    int length = input.readRawVarint32();
                    int oldLimit = input.pushLimit(length);
                    parseLTPC(input, data);
                    input.popLimit(oldLimit);
                } else if (fieldNumber == 2 && wireType == WireFormat.WIRETYPE_LENGTH_DELIMITED) {
                    // Field 2: FullFeed fullFeed
                    int length = input.readRawVarint32();
                    int oldLimit = input.pushLimit(length);
                    parseFullFeed(input, data);
                    input.popLimit(oldLimit);
                } else {
                    input.skipField(tag);
                }
            }
        } catch (Exception e) {
            log.trace("Error parsing Feed union: {}", e.getMessage());
        }

        return data;
    }

    private void parseFullFeed(CodedInputStream input, RawFeedData data) {
        try {
            while (!input.isAtEnd()) {
                int tag = input.readTag();
                if (tag == 0) break;

                int fieldNumber = WireFormat.getTagFieldNumber(tag);
                int wireType = WireFormat.getTagWireType(tag);

                if (fieldNumber == 1 && wireType == WireFormat.WIRETYPE_LENGTH_DELIMITED) {
                    // MarketFullFeed
                    int length = input.readRawVarint32();
                    int oldLimit = input.pushLimit(length);
                    parseMarketFullFeed(input, data);
                    input.popLimit(oldLimit);
                } else if (fieldNumber == 2 && wireType == WireFormat.WIRETYPE_LENGTH_DELIMITED) {
                    // IndexFullFeed
                    int length = input.readRawVarint32();
                    int oldLimit = input.pushLimit(length);
                    parseIndexFullFeed(input, data);
                    input.popLimit(oldLimit);
                } else {
                    input.skipField(tag);
                }
            }
        } catch (Exception e) {
            log.trace("Error parsing FullFeed: {}", e.getMessage());
        }
    }

    private void parseMarketFullFeed(CodedInputStream input, RawFeedData data) {
        try {
            while (!input.isAtEnd()) {
                int tag = input.readTag();
                if (tag == 0) break;

                int fieldNumber = WireFormat.getTagFieldNumber(tag);
                int wireType = WireFormat.getTagWireType(tag);

                if (fieldNumber == 1 && wireType == WireFormat.WIRETYPE_LENGTH_DELIMITED) {
                    int length = input.readRawVarint32();
                    int oldLimit = input.pushLimit(length);
                    parseLTPC(input, data);
                    input.popLimit(oldLimit);
                } else if (fieldNumber == 4 && wireType == WireFormat.WIRETYPE_LENGTH_DELIMITED) {
                    // MarketOHLC
                    int length = input.readRawVarint32();
                    int oldLimit = input.pushLimit(length);
                    parseMarketOHLC(input, data);
                    input.popLimit(oldLimit);
                } else if (fieldNumber == 6 && (wireType == WireFormat.WIRETYPE_FIXED64 || wireType == WireFormat.WIRETYPE_VARINT)) {
                    // Volume Traded Today (vtt)
                    if (wireType == WireFormat.WIRETYPE_FIXED64) {
                        data.volume = (long) input.readDouble();
                    } else {
                        data.volume = input.readInt64();
                    }
                } else {
                    input.skipField(tag);
                }
            }
        } catch (Exception e) {
            log.trace("Error parsing MarketFullFeed: {}", e.getMessage());
        }
    }

    private void parseIndexFullFeed(CodedInputStream input, RawFeedData data) {
        try {
            while (!input.isAtEnd()) {
                int tag = input.readTag();
                if (tag == 0) break;

                int fieldNumber = WireFormat.getTagFieldNumber(tag);
                int wireType = WireFormat.getTagWireType(tag);

                if (fieldNumber == 1 && wireType == WireFormat.WIRETYPE_LENGTH_DELIMITED) {
                    int length = input.readRawVarint32();
                    int oldLimit = input.pushLimit(length);
                    parseLTPC(input, data);
                    input.popLimit(oldLimit);
                } else if (fieldNumber == 2 && wireType == WireFormat.WIRETYPE_LENGTH_DELIMITED) {
                    // MarketOHLC
                    int length = input.readRawVarint32();
                    int oldLimit = input.pushLimit(length);
                    parseMarketOHLC(input, data);
                    input.popLimit(oldLimit);
                } else if (fieldNumber == 3 && wireType == WireFormat.WIRETYPE_FIXED64) {
                    data.ltp = input.readDouble();
                } else {
                    input.skipField(tag);
                }
            }
        } catch (Exception e) {
            log.trace("Error parsing IndexFullFeed: {}", e.getMessage());
        }
    }

    private void parseLTPC(CodedInputStream input, RawFeedData data) {
        try {
            while (!input.isAtEnd()) {
                int tag = input.readTag();
                if (tag == 0) break;

                int fieldNumber = WireFormat.getTagFieldNumber(tag);
                int wireType = WireFormat.getTagWireType(tag);

                if (fieldNumber == 1 && wireType == WireFormat.WIRETYPE_FIXED64) {
                    data.ltp = input.readDouble();
                } else if (fieldNumber == 2 && wireType == WireFormat.WIRETYPE_VARINT) {
                    data.ltt = input.readInt64();
                } else if (fieldNumber == 3 && wireType == WireFormat.WIRETYPE_VARINT) {
                    data.ltq = input.readInt64();
                } else if (fieldNumber == 4 && wireType == WireFormat.WIRETYPE_FIXED64) {
                    data.cp = input.readDouble();
                } else {
                    input.skipField(tag);
                }
            }
        } catch (Exception e) {
            log.trace("Error parsing LTPC: {}", e.getMessage());
        }
    }

    private void parseMarketOHLC(CodedInputStream input, RawFeedData data) {
        try {
            while (!input.isAtEnd()) {
                int tag = input.readTag();
                if (tag == 0) break;

                int fieldNumber = WireFormat.getTagFieldNumber(tag);
                int wireType = WireFormat.getTagWireType(tag);

                if (fieldNumber == 1 && wireType == WireFormat.WIRETYPE_LENGTH_DELIMITED) {
                    // repeated OHLC
                    int length = input.readRawVarint32();
                    int oldLimit = input.pushLimit(length);
                    parseOHLC(input, data);
                    input.popLimit(oldLimit);
                } else {
                    input.skipField(tag);
                }
            }
        } catch (Exception e) {
            log.trace("Error parsing MarketOHLC: {}", e.getMessage());
        }
    }

    private void parseOHLC(CodedInputStream input, RawFeedData data) {
        try {
            while (!input.isAtEnd()) {
                int tag = input.readTag();
                if (tag == 0) break;

                int fieldNumber = WireFormat.getTagFieldNumber(tag);
                int wireType = WireFormat.getTagWireType(tag);

                if (fieldNumber == 2 && wireType == WireFormat.WIRETYPE_FIXED64) {
                    data.open = input.readDouble();
                } else if (fieldNumber == 3 && wireType == WireFormat.WIRETYPE_FIXED64) {
                    data.high = input.readDouble();
                } else if (fieldNumber == 4 && wireType == WireFormat.WIRETYPE_FIXED64) {
                    data.low = input.readDouble();
                } else if (fieldNumber == 5 && wireType == WireFormat.WIRETYPE_FIXED64) {
                    data.close = input.readDouble();
                } else if (fieldNumber == 6 && wireType == WireFormat.WIRETYPE_VARINT) {
                    if (data.volume == 0) {
                        data.volume = input.readInt64();
                    }
                } else {
                    input.skipField(tag);
                }
            }
        } catch (Exception e) {
            log.trace("Error parsing OHLC: {}", e.getMessage());
        }
    }

    private String extractSymbolFromKey(String key) {
        if (key == null) return "UNKNOWN";
        if (key.contains("|")) {
            String after = key.substring(key.indexOf('|') + 1);
            if (!after.startsWith("INE") && !after.startsWith("IN0")) {
                return after;
            }
        }
        return key;
    }

    private static class RawFeedData {
        double ltp = 0;
        long ltt = 0;
        long ltq = 0;
        double cp = 0;
        double open = 0;
        double high = 0;
        double low = 0;
        double close = 0;
        long volume = 0;
    }
}
