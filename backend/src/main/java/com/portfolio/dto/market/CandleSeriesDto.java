package com.portfolio.dto.market;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.ArrayList;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class CandleSeriesDto {

    private String symbol;
    private String interval;
    private String currency;
    private String exchange;
    private String type;
    private List<CandleDto> candles = new ArrayList<>();

    public CandleSeriesDto() {}

    public CandleSeriesDto(String symbol, String interval, String currency, String exchange, String type, List<CandleDto> candles) {
        this.symbol = symbol;
        this.interval = interval;
        this.currency = currency;
        this.exchange = exchange;
        this.type = type;
        this.candles = candles != null ? candles : new ArrayList<>();
    }

    public String getSymbol() {
        return symbol;
    }

    public void setSymbol(String symbol) {
        this.symbol = symbol;
    }

    public String getInterval() {
        return interval;
    }

    public void setInterval(String interval) {
        this.interval = interval;
    }

    public String getCurrency() {
        return currency;
    }

    public void setCurrency(String currency) {
        this.currency = currency;
    }

    public String getExchange() {
        return exchange;
    }

    public void setExchange(String exchange) {
        this.exchange = exchange;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public List<CandleDto> getCandles() {
        return candles;
    }

    public void setCandles(List<CandleDto> candles) {
        this.candles = candles != null ? candles : new ArrayList<>();
    }
}
