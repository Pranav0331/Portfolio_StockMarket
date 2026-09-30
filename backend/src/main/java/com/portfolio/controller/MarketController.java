package com.portfolio.controller;

import com.portfolio.dto.market.MarketPriceDto;
import com.portfolio.dto.market.StockQuoteDto;
import com.portfolio.dto.market.StockSearchResponseDto;
import com.portfolio.service.MarketDataService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/market")
public class MarketController {

    private final MarketDataService marketDataService;

    public MarketController(MarketDataService marketDataService) {
        this.marketDataService = marketDataService;
    }

    @GetMapping("/forex")
    public ResponseEntity<MarketPriceDto> getForexPrice(@RequestParam("symbol") String symbol) {
        MarketPriceDto forex = marketDataService.getForexPrice(symbol);
        return ResponseEntity.ok(forex);
    }

    @GetMapping("/crypto")
    public ResponseEntity<MarketPriceDto> getCryptoPrice(@RequestParam("symbol") String symbol) {
        MarketPriceDto crypto = marketDataService.getCryptoPrice(symbol);
        return ResponseEntity.ok(crypto);
    }

    @GetMapping("/quote")
    public ResponseEntity<StockQuoteDto> getQuote(@RequestParam("symbol") String symbol) {
        StockQuoteDto quote = marketDataService.getQuote(symbol);
        return ResponseEntity.ok(quote);
    }

    @GetMapping("/search")
    public ResponseEntity<StockSearchResponseDto> searchSymbols(@RequestParam("keywords") String keywords) {
        StockSearchResponseDto searchResult = marketDataService.searchSymbols(keywords);
        return ResponseEntity.ok(searchResult);
    }
}
