package com.portfolio.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.portfolio.dto.watchlist.AddWatchlistRequest;
import com.portfolio.dto.watchlist.ReorderWatchlistRequest;
import com.portfolio.dto.watchlist.WatchlistItemDto;
import com.portfolio.dto.watchlist.WatchlistResponseDto;
import com.portfolio.entity.User;
import com.portfolio.entity.enums.AuthProvider;
import com.portfolio.entity.enums.UserRole;
import com.portfolio.entity.enums.UserStatus;
import com.portfolio.repository.UserRepository;
import com.portfolio.security.jwt.JwtTokenProvider;
import com.portfolio.service.WatchlistService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class WatchlistControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JwtTokenProvider jwtTokenProvider;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private WatchlistService watchlistService;

    private User testUser;
    private String jwtToken;

    @BeforeEach
    void setUp() {
        userRepository.deleteAll();

        testUser = new User("watchlistuser@example.com", "Watchlist Trader");
        testUser.setPasswordHash("hashed_pw");
        testUser.setRole(UserRole.ROLE_USER);
        testUser.setStatus(UserStatus.ACTIVE);
        testUser.setProvider(AuthProvider.LOCAL);
        testUser = userRepository.save(testUser);

        jwtToken = jwtTokenProvider.generateToken(com.portfolio.security.UserPrincipal.create(testUser));
    }

    @Test
    @DisplayName("1. GET /api/watchlist with JWT returns user's watchlist")
    void testGetWatchlistAuthenticated() throws Exception {
        WatchlistItemDto item = new WatchlistItemDto(
                101L, 10L, "RELIANCE", "Reliance Industries Ltd", "NSE", "INR",
                "STOCKS", new BigDecimal("3000.00"), new BigDecimal("50.00"), "+1.69%",
                new BigDecimal("2950.00"), 100000L, 0, true,
                System.currentTimeMillis(), "Upstox", "Core holding"
        );

        WatchlistResponseDto responseDto = new WatchlistResponseDto(
                List.of(item), List.of("INDICES", "STOCKS", "FOREX", "CRYPTO"), 1, System.currentTimeMillis()
        );

        when(watchlistService.getUserWatchlist(eq(testUser.getId()))).thenReturn(responseDto);

        mockMvc.perform(get("/api/watchlist")
                        .header("Authorization", "Bearer " + jwtToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalCount").value(1))
                .andExpect(jsonPath("$.items[0].symbol").value("RELIANCE"))
                .andExpect(jsonPath("$.items[0].category").value("STOCKS"));
    }

    @Test
    @DisplayName("2. POST /api/watchlist adds new symbol and returns HTTP 201 Created")
    void testAddToWatchlist() throws Exception {
        AddWatchlistRequest req = new AddWatchlistRequest("AAPL", "STOCKS", "Tech leader");
        WatchlistItemDto item = new WatchlistItemDto(
                102L, 20L, "AAPL", "Apple Inc.", "NASDAQ", "USD",
                "STOCKS", new BigDecimal("230.00"), new BigDecimal("5.00"), "+2.22%",
                new BigDecimal("225.00"), 500000L, 1, true,
                System.currentTimeMillis(), "Twelve Data", "Tech leader"
        );

        when(watchlistService.addToWatchlist(eq(testUser.getId()), any(AddWatchlistRequest.class))).thenReturn(item);

        mockMvc.perform(post("/api/watchlist")
                        .header("Authorization", "Bearer " + jwtToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.symbol").value("AAPL"))
                .andExpect(jsonPath("$.category").value("STOCKS"));
    }

    @Test
    @DisplayName("3. DELETE /api/watchlist/{id} removes symbol from watchlist")
    void testRemoveFromWatchlist() throws Exception {
        doNothing().when(watchlistService).removeFromWatchlist(eq(testUser.getId()), eq(101L));

        mockMvc.perform(delete("/api/watchlist/101")
                        .header("Authorization", "Bearer " + jwtToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Item successfully removed from watchlist"));
    }

    @Test
    @DisplayName("4. PUT /api/watchlist/reorder updates watchlist items display order")
    void testReorderWatchlist() throws Exception {
        ReorderWatchlistRequest req = new ReorderWatchlistRequest(List.of(102L, 101L));
        doNothing().when(watchlistService).reorderWatchlist(eq(testUser.getId()), any(ReorderWatchlistRequest.class));

        mockMvc.perform(put("/api/watchlist/reorder")
                        .header("Authorization", "Bearer " + jwtToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Watchlist order updated successfully"));
    }

    @Test
    @DisplayName("5. GET /api/watchlist without JWT returns HTTP 401 Unauthorized")
    void testUnauthenticated() throws Exception {
        mockMvc.perform(get("/api/watchlist"))
                .andExpect(status().isUnauthorized());
    }
}
