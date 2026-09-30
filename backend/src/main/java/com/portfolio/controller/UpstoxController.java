package com.portfolio.controller;

import com.portfolio.dto.market.CandleSeriesDto;
import com.portfolio.dto.market.StockQuoteDto;
import com.portfolio.dto.market.StockSearchResponseDto;
import com.portfolio.dto.upstox.UpstoxAuthStatusDto;
import com.portfolio.dto.upstox.UpstoxAuthUrlDto;
import com.portfolio.service.UpstoxService;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.net.URI;
import java.util.Map;

@RestController
@RequestMapping("/api/upstox")
public class UpstoxController {

    private final UpstoxService upstoxService;

    public UpstoxController(UpstoxService upstoxService) {
        this.upstoxService = upstoxService;
    }

    /**
     * Step 1: Get the Upstox OAuth 2.0 authorization URL
     */
    @GetMapping("/auth-url")
    public ResponseEntity<UpstoxAuthUrlDto> getAuthUrl() {
        String url = upstoxService.getAuthorizationUrl();
        return ResponseEntity.ok(new UpstoxAuthUrlDto(url));
    }

    /**
     * Step 1 (Browser redirect): Direct browser redirect to Upstox login dialog
     */
    @GetMapping("/login")
    public ResponseEntity<Void> loginRedirect() {
        String url = upstoxService.getAuthorizationUrl();
        return ResponseEntity.status(HttpStatus.FOUND)
                .location(URI.create(url))
                .build();
    }

    /**
     * Step 2: OAuth 2.0 Callback endpoint
     * Upstox redirects here with the authorization code: GET /api/upstox/callback?code={code}
     */
    @GetMapping(value = "/callback")
    public ResponseEntity<?> handleCallback(
            @RequestParam(value = "code", required = false) String code,
            @RequestParam(value = "error", required = false) String error,
            @RequestParam(value = "error_description", required = false) String errorDescription,
            @RequestHeader(value = HttpHeaders.ACCEPT, required = false) String acceptHeader,
            HttpServletResponse response
    ) throws IOException {
        if (error != null) {
            String msg = errorDescription != null ? errorDescription : error;
            if (acceptHeader != null && acceptHeader.contains(MediaType.TEXT_HTML_VALUE)) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .contentType(MediaType.TEXT_HTML)
                        .body("<html><body style='font-family:sans-serif;text-align:center;padding:50px;'><h2>Upstox Authorization Failed</h2><p>" + msg + "</p><a href='/api/upstox/login'>Try Again</a></body></html>");
            }
            return ResponseEntity.badRequest().body(Map.of("error", error, "message", msg));
        }

        if (code == null || code.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "missing_code", "message", "Authorization code is required"));
        }

        UpstoxAuthStatusDto status = upstoxService.exchangeCodeForToken(code);

        // If accessed by browser, return clean HTML confirmation
        if (acceptHeader != null && acceptHeader.contains(MediaType.TEXT_HTML_VALUE)) {
            String html = """
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Upstox Connected</title>
                    <style>
                        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
                        .card { background: #1e293b; padding: 40px; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); text-align: center; max-width: 440px; border: 1px solid #334155; }
                        h2 { color: #38bdf8; margin-bottom: 10px; }
                        p { color: #94a3b8; font-size: 14px; }
                        .badge { display: inline-block; background: #065f46; color: #34d399; padding: 6px 14px; border-radius: 9999px; font-weight: 600; font-size: 13px; margin: 15px 0; }
                        .btn { display: inline-block; background: #38bdf8; color: #0f172a; font-weight: 600; padding: 10px 24px; border-radius: 8px; text-decoration: none; margin-top: 15px; }
                    </style>
                </head>
                <body>
                    <div class="card">
                        <h2>Upstox Connected!</h2>
                        <div class="badge">&#10003; Successfully Authorized</div>
                        <p>User: <strong>%s</strong> (ID: %s)</p>
                        <p>You can now fetch live Indian NSE/BSE stock quotes and historical candlestick charts.</p>
                        <a class="btn" href="http://localhost:4200/dashboard/market">Return to Market Dashboard</a>
                    </div>
                </body>
                </html>
                """.formatted(
                    status.userName() != null ? status.userName() : "Upstox User",
                    status.userId() != null ? status.userId() : "N/A"
            );
            return ResponseEntity.ok().contentType(MediaType.TEXT_HTML).body(html);
        }

        return ResponseEntity.ok(status);
    }

    /**
     * Check if Upstox token is present and active
     */
    @GetMapping("/status")
    public ResponseEntity<UpstoxAuthStatusDto> getStatus() {
        UpstoxAuthStatusDto status = upstoxService.getAuthStatus();
        return ResponseEntity.ok(status);
    }

    /**
     * Manually provide access token (useful for developers/testing)
     */
    @PostMapping("/token")
    public ResponseEntity<UpstoxAuthStatusDto> setToken(@RequestBody Map<String, String> body) {
        String token = body.get("accessToken");
        if (token == null) {
            token = body.get("token");
        }
        String userName = body.get("userName");
        String userId = body.get("userId");
        UpstoxAuthStatusDto status = upstoxService.setAccessToken(token, userName, userId);
        return ResponseEntity.ok(status);
    }

    /**
     * Clear the active Upstox session
     */
    @PostMapping("/logout")
    public ResponseEntity<Map<String, String>> logout() {
        upstoxService.logout();
        return ResponseEntity.ok(Map.of("message", "Upstox session disconnected"));
    }

    /**
     * Fetch real-time Indian stock/index quote from Upstox
     */
    @GetMapping("/quote")
    public ResponseEntity<StockQuoteDto> getQuote(@RequestParam("symbol") String symbol) {
        StockQuoteDto quote = upstoxService.getQuote(symbol);
        return ResponseEntity.ok(quote);
    }

    /**
     * Fetch candlestick data for Indian stock/index from Upstox
     */
    @GetMapping("/candles")
    public ResponseEntity<CandleSeriesDto> getCandles(
            @RequestParam("symbol") String symbol,
            @RequestParam(value = "interval", defaultValue = "30minute") String interval,
            @RequestParam(value = "outputsize", required = false) Integer outputsize
    ) {
        CandleSeriesDto candles = upstoxService.getCandles(symbol, interval, outputsize);
        return ResponseEntity.ok(candles);
    }

    /**
     * Search Indian stocks and indices
     */
    @GetMapping("/search")
    public ResponseEntity<StockSearchResponseDto> searchSymbols(@RequestParam("keywords") String keywords) {
        StockSearchResponseDto results = upstoxService.searchSymbols(keywords);
        return ResponseEntity.ok(results);
    }
}
