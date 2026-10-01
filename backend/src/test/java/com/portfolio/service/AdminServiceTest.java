package com.portfolio.service;

import com.portfolio.dto.admin.*;
import com.portfolio.entity.Order;
import com.portfolio.entity.Stock;
import com.portfolio.entity.Transaction;
import com.portfolio.entity.User;
import com.portfolio.entity.enums.*;
import com.portfolio.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AdminServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private OrderRepository orderRepository;

    @Mock
    private TransactionRepository transactionRepository;

    @Mock
    private HoldingRepository holdingRepository;

    @Mock
    private AlertRepository alertRepository;

    @Mock
    private WatchlistRepository watchlistRepository;

    private AdminService adminService;

    private User adminUser;
    private User normalUser;
    private Stock testStock;

    @BeforeEach
    void setUp() {
        adminService = new AdminService(
                userRepository,
                orderRepository,
                transactionRepository,
                holdingRepository,
                alertRepository,
                watchlistRepository
        );

        adminUser = new User("admin@example.com", "Admin User");
        adminUser.setId(1L);
        adminUser.setRole(UserRole.ROLE_ADMIN);
        adminUser.setStatus(UserStatus.ACTIVE);
        adminUser.setCreatedAt(Instant.now());

        normalUser = new User("trader@example.com", "Trader User");
        normalUser.setId(2L);
        normalUser.setRole(UserRole.ROLE_USER);
        normalUser.setStatus(UserStatus.ACTIVE);
        normalUser.setCreatedAt(Instant.now());

        testStock = new Stock("AAPL", "Apple Inc.", "NASDAQ", "USD");
        testStock.setId(10L);
    }

    @Test
    @DisplayName("getDashboardSummary - aggregates stats and recent items correctly")
    void testGetDashboardSummary() {
        when(userRepository.count()).thenReturn(100L);
        when(userRepository.countByStatus(UserStatus.ACTIVE)).thenReturn(90L);
        when(userRepository.countByStatus(UserStatus.SUSPENDED)).thenReturn(5L);
        when(userRepository.countByStatus(UserStatus.INACTIVE)).thenReturn(5L);

        when(orderRepository.count()).thenReturn(500L);
        when(transactionRepository.count()).thenReturn(450L);
        when(holdingRepository.count()).thenReturn(200L);
        when(alertRepository.count()).thenReturn(80L);
        when(watchlistRepository.count()).thenReturn(150L);

        when(userRepository.findAllByOrderByCreatedAtDesc()).thenReturn(List.of(normalUser, adminUser));
        when(orderRepository.findAllByOrderByCreatedAtDesc()).thenReturn(List.of());
        when(transactionRepository.findAllByOrderByCreatedAtDesc()).thenReturn(List.of());

        AdminDashboardSummaryDto summary = adminService.getDashboardSummary();

        assertThat(summary.stats().totalUsers()).isEqualTo(100L);
        assertThat(summary.stats().activeUsers()).isEqualTo(90L);
        assertThat(summary.stats().totalOrders()).isEqualTo(500L);
        assertThat(summary.recentUsers()).hasSize(2);
    }

    @Test
    @DisplayName("getUsers - filters by search query, role, and status")
    void testGetUsers_Filtering() {
        when(userRepository.findAllByOrderByCreatedAtDesc()).thenReturn(List.of(adminUser, normalUser));

        // Filter by search query
        List<AdminUserDto> searchResults = adminService.getUsers("trader", null, null);
        assertThat(searchResults).hasSize(1);
        assertThat(searchResults.get(0).email()).isEqualTo("trader@example.com");

        // Filter by role ADMIN
        List<AdminUserDto> adminResults = adminService.getUsers(null, "ROLE_ADMIN", null);
        assertThat(adminResults).hasSize(1);
        assertThat(adminResults.get(0).role()).isEqualTo("ROLE_ADMIN");

        // Filter by status ACTIVE
        List<AdminUserDto> activeResults = adminService.getUsers(null, null, "ACTIVE");
        assertThat(activeResults).hasSize(2);
    }

    @Test
    @DisplayName("updateUserStatus - updates target user status")
    void testUpdateUserStatus_Success() {
        when(userRepository.findById(2L)).thenReturn(Optional.of(normalUser));
        when(userRepository.save(any(User.class))).thenReturn(normalUser);

        UpdateUserStatusRequest request = new UpdateUserStatusRequest("SUSPENDED");
        AdminUserDto updated = adminService.updateUserStatus(1L, 2L, request);

        assertThat(normalUser.getStatus()).isEqualTo(UserStatus.SUSPENDED);
        assertThat(updated.status()).isEqualTo("SUSPENDED");
    }

    @Test
    @DisplayName("updateUserStatus - prevents admin from deactivating self")
    void testUpdateUserStatus_PreventSelfDeactivation() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(adminUser));

        UpdateUserStatusRequest request = new UpdateUserStatusRequest("INACTIVE");
        assertThatThrownBy(() -> adminService.updateUserStatus(1L, 1L, request))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Admin cannot deactivate or suspend their own account");
    }

    @Test
    @DisplayName("updateUserRole - updates target user role")
    void testUpdateUserRole_Success() {
        when(userRepository.findById(2L)).thenReturn(Optional.of(normalUser));
        when(userRepository.save(any(User.class))).thenReturn(normalUser);

        UpdateUserRoleRequest request = new UpdateUserRoleRequest("ROLE_ADMIN");
        AdminUserDto updated = adminService.updateUserRole(1L, 2L, request);

        assertThat(normalUser.getRole()).isEqualTo(UserRole.ROLE_ADMIN);
        assertThat(updated.role()).isEqualTo("ROLE_ADMIN");
    }

    @Test
    @DisplayName("updateUserRole - prevents admin from revoking self admin role")
    void testUpdateUserRole_PreventSelfDemotion() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(adminUser));

        UpdateUserRoleRequest request = new UpdateUserRoleRequest("ROLE_USER");
        assertThatThrownBy(() -> adminService.updateUserRole(1L, 1L, request))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Admin cannot revoke their own admin role");
    }
}
