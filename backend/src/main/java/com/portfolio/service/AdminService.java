package com.portfolio.service;

import com.portfolio.dto.admin.*;
import com.portfolio.entity.Order;
import com.portfolio.entity.Transaction;
import com.portfolio.entity.User;
import com.portfolio.entity.enums.UserRole;
import com.portfolio.entity.enums.UserStatus;
import com.portfolio.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;

@Service
public class AdminService {

    private static final Logger log = LoggerFactory.getLogger(AdminService.class);

    private final UserRepository userRepository;
    private final OrderRepository orderRepository;
    private final TransactionRepository transactionRepository;
    private final HoldingRepository holdingRepository;
    private final AlertRepository alertRepository;
    private final WatchlistRepository watchlistRepository;

    public AdminService(
            UserRepository userRepository,
            OrderRepository orderRepository,
            TransactionRepository transactionRepository,
            HoldingRepository holdingRepository,
            AlertRepository alertRepository,
            WatchlistRepository watchlistRepository
    ) {
        this.userRepository = userRepository;
        this.orderRepository = orderRepository;
        this.transactionRepository = transactionRepository;
        this.holdingRepository = holdingRepository;
        this.alertRepository = alertRepository;
        this.watchlistRepository = watchlistRepository;
    }

    @Transactional(readOnly = true)
    public AdminDashboardSummaryDto getDashboardSummary() {
        long totalUsers = userRepository.count();
        long activeUsers = userRepository.countByStatus(UserStatus.ACTIVE);
        long suspendedUsers = userRepository.countByStatus(UserStatus.SUSPENDED);
        long inactiveUsers = userRepository.countByStatus(UserStatus.INACTIVE);

        long totalOrders = orderRepository.count();
        long totalTransactions = transactionRepository.count();
        long totalHoldings = holdingRepository.count();
        long totalAlerts = alertRepository.count();
        long totalWatchlistItems = watchlistRepository.count();

        AdminStatsDto stats = new AdminStatsDto(
                totalUsers,
                activeUsers,
                suspendedUsers,
                inactiveUsers,
                totalOrders,
                totalTransactions,
                totalHoldings,
                totalAlerts,
                totalWatchlistItems,
                System.currentTimeMillis()
        );

        List<AdminUserDto> recentUsers = userRepository.findAllByOrderByCreatedAtDesc().stream()
                .limit(10)
                .map(this::mapToAdminUserDto)
                .collect(Collectors.toList());

        List<AdminOrderDto> recentOrders = orderRepository.findAllByOrderByCreatedAtDesc().stream()
                .limit(15)
                .map(this::mapToAdminOrderDto)
                .collect(Collectors.toList());

        List<AdminTransactionDto> recentTransactions = transactionRepository.findAllByOrderByCreatedAtDesc().stream()
                .limit(15)
                .map(this::mapToAdminTransactionDto)
                .collect(Collectors.toList());

        return new AdminDashboardSummaryDto(
                stats,
                recentUsers,
                recentOrders,
                recentTransactions
        );
    }

    @Transactional(readOnly = true)
    public List<AdminUserDto> getUsers(String query, String role, String status) {
        List<User> users = userRepository.findAllByOrderByCreatedAtDesc();

        return users.stream()
                .filter(u -> {
                    if (query != null && !query.trim().isEmpty()) {
                        String q = query.trim().toLowerCase(Locale.ROOT);
                        boolean matchEmail = u.getEmail() != null && u.getEmail().toLowerCase(Locale.ROOT).contains(q);
                        boolean matchName = u.getFullName() != null && u.getFullName().toLowerCase(Locale.ROOT).contains(q);
                        if (!matchEmail && !matchName) return false;
                    }
                    if (role != null && !role.trim().isEmpty() && !role.equalsIgnoreCase("ALL")) {
                        String r = normalizeRole(role).name();
                        if (!u.getRole().name().equalsIgnoreCase(r)) return false;
                    }
                    if (status != null && !status.trim().isEmpty() && !status.equalsIgnoreCase("ALL")) {
                        if (!u.getStatus().name().equalsIgnoreCase(status.trim())) return false;
                    }
                    return true;
                })
                .map(this::mapToAdminUserDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public AdminUserDto getUserById(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found with id: " + userId));
        return mapToAdminUserDto(user);
    }

    @Transactional
    public AdminUserDto updateUserStatus(Long adminUserId, Long targetUserId, UpdateUserStatusRequest request) {
        if (targetUserId == null || request == null || request.status() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Target User ID and status are required");
        }

        User targetUser = userRepository.findById(targetUserId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found with id: " + targetUserId));

        UserStatus newStatus;
        try {
            newStatus = UserStatus.valueOf(request.status().trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid status: " + request.status() + ". Allowed: ACTIVE, INACTIVE, SUSPENDED");
        }

        // Prevent admin from deactivating/suspending themselves
        if (adminUserId != null && adminUserId.equals(targetUserId) && newStatus != UserStatus.ACTIVE) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Admin cannot deactivate or suspend their own account");
        }

        targetUser.setStatus(newStatus);
        targetUser = userRepository.save(targetUser);
        log.info("Admin {} changed status of user {} to {}", adminUserId, targetUserId, newStatus);

        return mapToAdminUserDto(targetUser);
    }

    @Transactional
    public AdminUserDto updateUserRole(Long adminUserId, Long targetUserId, UpdateUserRoleRequest request) {
        if (targetUserId == null || request == null || request.role() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Target User ID and role are required");
        }

        User targetUser = userRepository.findById(targetUserId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found with id: " + targetUserId));

        UserRole newRole = normalizeRole(request.role());

        // Prevent admin from removing their own admin role
        if (adminUserId != null && adminUserId.equals(targetUserId) && newRole != UserRole.ROLE_ADMIN) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Admin cannot revoke their own admin role");
        }

        targetUser.setRole(newRole);
        targetUser = userRepository.save(targetUser);
        log.info("Admin {} changed role of user {} to {}", adminUserId, targetUserId, newRole);

        return mapToAdminUserDto(targetUser);
    }

    @Transactional(readOnly = true)
    public List<AdminOrderDto> getRecentOrders(int limit) {
        int max = limit > 0 ? limit : 50;
        return orderRepository.findAllByOrderByCreatedAtDesc().stream()
                .limit(max)
                .map(this::mapToAdminOrderDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<AdminTransactionDto> getRecentTransactions(int limit) {
        int max = limit > 0 ? limit : 50;
        return transactionRepository.findAllByOrderByCreatedAtDesc().stream()
                .limit(max)
                .map(this::mapToAdminTransactionDto)
                .collect(Collectors.toList());
    }

    private UserRole normalizeRole(String roleStr) {
        if (roleStr == null) return UserRole.ROLE_USER;
        String r = roleStr.trim().toUpperCase(Locale.ROOT);
        if (r.equals("ADMIN") || r.equals("ROLE_ADMIN")) {
            return UserRole.ROLE_ADMIN;
        }
        return UserRole.ROLE_USER;
    }

    private AdminUserDto mapToAdminUserDto(User user) {
        int holdingsCount = user.getHoldings() != null ? user.getHoldings().size() : 0;
        int ordersCount = user.getOrders() != null ? user.getOrders().size() : 0;
        int transactionsCount = user.getTransactions() != null ? user.getTransactions().size() : 0;
        int alertsCount = user.getAlerts() != null ? user.getAlerts().size() : 0;
        int watchlistCount = user.getWatchlist() != null ? user.getWatchlist().size() : 0;

        Long createdAtMs = user.getCreatedAt() != null ? user.getCreatedAt().toEpochMilli() : null;
        Long updatedAtMs = user.getUpdatedAt() != null ? user.getUpdatedAt().toEpochMilli() : null;

        // Virtual cash calculation from transactions
        BigDecimal virtualCash = BigDecimal.valueOf(100000.00); // base initial cash
        if (user.getTransactions() != null) {
            for (Transaction tx : user.getTransactions()) {
                if (tx.getStatus() != null && tx.getStatus().name().equals("SUCCESS")) {
                    BigDecimal amount = tx.getTotalAmount() != null ? tx.getTotalAmount() : BigDecimal.ZERO;
                    BigDecimal fee = tx.getFees() != null ? tx.getFees() : BigDecimal.ZERO;
                    if (tx.getTransactionType() != null && tx.getTransactionType().name().equals("BUY")) {
                        virtualCash = virtualCash.subtract(amount.add(fee));
                    } else if (tx.getTransactionType() != null && tx.getTransactionType().name().equals("SELL")) {
                        virtualCash = virtualCash.add(amount.subtract(fee));
                    }
                }
            }
        }

        return new AdminUserDto(
                user.getId(),
                user.getEmail(),
                user.getFullName(),
                user.getRole().name(),
                user.getStatus().name(),
                user.getProvider() != null ? user.getProvider().name() : "LOCAL",
                createdAtMs,
                updatedAtMs,
                holdingsCount,
                ordersCount,
                transactionsCount,
                alertsCount,
                watchlistCount,
                virtualCash
        );
    }

    private AdminOrderDto mapToAdminOrderDto(Order order) {
        User user = order.getUser();
        Long userId = user != null ? user.getId() : null;
        String email = user != null ? user.getEmail() : "Unknown";
        String fullName = user != null ? user.getFullName() : "Unknown";

        String symbol = order.getStock() != null ? order.getStock().getSymbol() : "UNKNOWN";
        String companyName = order.getStock() != null ? order.getStock().getCompanyName() : symbol;

        BigDecimal totalAmount = order.getQuantity() != null && order.getPrice() != null
                ? order.getQuantity().multiply(order.getPrice())
                : BigDecimal.ZERO;

        Long createdAtMs = order.getCreatedAt() != null ? order.getCreatedAt().toEpochMilli() : null;

        return new AdminOrderDto(
                order.getId(),
                userId,
                email,
                fullName,
                symbol,
                companyName,
                order.getOrderType() != null ? order.getOrderType().name() : "BUY",
                order.getQuantity(),
                order.getPrice(),
                totalAmount,
                order.getOrderStatus() != null ? order.getOrderStatus().name() : "PENDING",
                createdAtMs
        );
    }

    private AdminTransactionDto mapToAdminTransactionDto(Transaction tx) {
        User user = tx.getUser();
        Long userId = user != null ? user.getId() : null;
        String email = user != null ? user.getEmail() : "Unknown";
        String fullName = user != null ? user.getFullName() : "Unknown";

        String symbol = tx.getStock() != null ? tx.getStock().getSymbol() : "UNKNOWN";
        String companyName = tx.getStock() != null ? tx.getStock().getCompanyName() : symbol;

        Long createdAtMs = tx.getCreatedAt() != null ? tx.getCreatedAt().toEpochMilli() : null;

        return new AdminTransactionDto(
                tx.getId(),
                userId,
                email,
                fullName,
                symbol,
                companyName,
                tx.getTransactionType() != null ? tx.getTransactionType().name() : "BUY",
                tx.getQuantity(),
                tx.getPricePerUnit(),
                tx.getTotalAmount(),
                tx.getFees(),
                tx.getStatus() != null ? tx.getStatus().name() : "SUCCESS",
                createdAtMs
        );
    }
}
