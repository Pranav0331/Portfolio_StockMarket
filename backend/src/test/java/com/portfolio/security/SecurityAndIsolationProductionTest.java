package com.portfolio.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.portfolio.dto.alert.CreateAlertRequest;
import com.portfolio.dto.watchlist.AddWatchlistRequest;
import com.portfolio.entity.Stock;
import com.portfolio.entity.User;
import com.portfolio.entity.enums.AuthProvider;
import com.portfolio.entity.enums.UserRole;
import com.portfolio.entity.enums.UserStatus;
import com.portfolio.repository.AlertRepository;
import com.portfolio.repository.HoldingRepository;
import com.portfolio.repository.StockRepository;
import com.portfolio.repository.TransactionRepository;
import com.portfolio.repository.UserRepository;
import com.portfolio.repository.WatchlistRepository;
import com.portfolio.security.jwt.JwtTokenProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class SecurityAndIsolationProductionTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private StockRepository stockRepository;

    @Autowired
    private HoldingRepository holdingRepository;

    @Autowired
    private TransactionRepository transactionRepository;

    @Autowired
    private WatchlistRepository watchlistRepository;

    @Autowired
    private AlertRepository alertRepository;

    @Autowired
    private JwtTokenProvider jwtTokenProvider;

    @Autowired
    private ObjectMapper objectMapper;

    private User userA;
    private User userB;
    private User adminUser;
    private String tokenA;
    private String tokenB;
    private String adminToken;
    private Stock aaplStock;

    @BeforeEach
    void setUp() {
        alertRepository.deleteAll();
        watchlistRepository.deleteAll();
        transactionRepository.deleteAll();
        holdingRepository.deleteAll();
        userRepository.deleteAll();

        aaplStock = stockRepository.findBySymbol("AAPL").orElseGet(() -> {
            Stock s = new Stock("AAPL", "Apple Inc.", "NASDAQ", "USD");
            s.setCurrentPrice(new BigDecimal("230.00"));
            return stockRepository.save(s);
        });

        userA = new User("usera@example.com", "User Alpha");
        userA.setPasswordHash("hash123");
        userA.setRole(UserRole.ROLE_USER);
        userA.setStatus(UserStatus.ACTIVE);
        userA.setProvider(AuthProvider.LOCAL);
        userA = userRepository.save(userA);

        userB = new User("userb@example.com", "User Beta");
        userB.setPasswordHash("hash123");
        userB.setRole(UserRole.ROLE_USER);
        userB.setStatus(UserStatus.ACTIVE);
        userB.setProvider(AuthProvider.LOCAL);
        userB = userRepository.save(userB);

        adminUser = new User("admin@example.com", "Admin System");
        adminUser.setPasswordHash("hash123");
        adminUser.setRole(UserRole.ROLE_ADMIN);
        adminUser.setStatus(UserStatus.ACTIVE);
        adminUser.setProvider(AuthProvider.LOCAL);
        adminUser = userRepository.save(adminUser);

        tokenA = jwtTokenProvider.generateToken(UserPrincipal.create(userA));
        tokenB = jwtTokenProvider.generateToken(UserPrincipal.create(userB));
        adminToken = jwtTokenProvider.generateToken(UserPrincipal.create(adminUser));
    }

    @Test
    @DisplayName("1. User A cannot see User B watchlist data (strict isolation)")
    void testWatchlistIsolation() throws Exception {
        // User A adds AAPL to watchlist
        AddWatchlistRequest reqA = new AddWatchlistRequest("AAPL", "Favorites", "Personal Watch");
        mockMvc.perform(post("/api/watchlist")
                        .header("Authorization", "Bearer " + tokenA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(reqA)))
                .andExpect(status().isCreated());

        // User A should see 1 item in watchlist
        mockMvc.perform(get("/api/watchlist")
                        .header("Authorization", "Bearer " + tokenA))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items", hasSize(1)))
                .andExpect(jsonPath("$.items[0].symbol").value("AAPL"));

        // User B must see 0 items in their watchlist
        mockMvc.perform(get("/api/watchlist")
                        .header("Authorization", "Bearer " + tokenB))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items", hasSize(0)))
                .andExpect(jsonPath("$.totalCount").value(0));
    }

    @Test
    @DisplayName("2. User A cannot see or delete User B alerts (strict isolation)")
    void testAlertsIsolation() throws Exception {
        // User A creates alert
        CreateAlertRequest alertReq = new CreateAlertRequest("AAPL", "ABOVE", new BigDecimal("250.00"), "Sell target");
        String res = mockMvc.perform(post("/api/alerts")
                        .header("Authorization", "Bearer " + tokenA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(alertReq)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();

        Long alertIdA = objectMapper.readTree(res).get("id").asLong();

        // User B cannot see User A's alerts
        mockMvc.perform(get("/api/alerts")
                        .header("Authorization", "Bearer " + tokenB))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.alerts", hasSize(0)))
                .andExpect(jsonPath("$.totalCount").value(0));

        // User B cannot delete User A's alert
        mockMvc.perform(delete("/api/alerts/" + alertIdA)
                        .header("Authorization", "Bearer " + tokenB))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("3. Unauthenticated requests to protected endpoints return 401 Unauthorized")
    void testUnauthenticatedRequests() throws Exception {
        mockMvc.perform(get("/api/portfolio")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/portfolio/risk")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/transactions")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/watchlist")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/alerts")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/admin/summary")).andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("4. Normal user (ROLE_USER) cannot access admin endpoints (403 Forbidden)")
    void testRoleBasedAccessControl() throws Exception {
        mockMvc.perform(get("/api/admin/summary")
                        .header("Authorization", "Bearer " + tokenA))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/admin/users")
                        .header("Authorization", "Bearer " + tokenB))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("5. Admin user (ROLE_ADMIN) can access admin dashboard")
    void testAdminAccessAllowed() throws Exception {
        mockMvc.perform(get("/api/admin/summary")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.stats.totalUsers").isNumber());

        mockMvc.perform(get("/api/admin/users")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());
    }

    @Test
    @DisplayName("6. Malformed or invalid JWT token is rejected with 401 Unauthorized")
    void testMalformedTokenRejected() throws Exception {
        mockMvc.perform(get("/api/portfolio")
                        .header("Authorization", "Bearer invalid.fake.token"))
                .andExpect(status().isUnauthorized());
    }
}
