package com.portfolio.controller;

import com.portfolio.dto.admin.*;
import com.portfolio.security.UserPrincipal;
import com.portfolio.service.AdminService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasRole('ADMIN')")
public class AdminController {

    private final AdminService adminService;

    public AdminController(AdminService adminService) {
        this.adminService = adminService;
    }

    @GetMapping("/summary")
    public ResponseEntity<AdminDashboardSummaryDto> getDashboardSummary(
            @AuthenticationPrincipal UserPrincipal userPrincipal
    ) {
        verifyAdmin(userPrincipal);
        AdminDashboardSummaryDto summary = adminService.getDashboardSummary();
        return ResponseEntity.ok(summary);
    }

    @GetMapping("/users")
    public ResponseEntity<List<AdminUserDto>> getUsers(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @RequestParam(required = false) String query,
            @RequestParam(required = false) String role,
            @RequestParam(required = false) String status
    ) {
        verifyAdmin(userPrincipal);
        List<AdminUserDto> users = adminService.getUsers(query, role, status);
        return ResponseEntity.ok(users);
    }

    @GetMapping("/users/{id}")
    public ResponseEntity<AdminUserDto> getUserById(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @PathVariable Long id
    ) {
        verifyAdmin(userPrincipal);
        AdminUserDto user = adminService.getUserById(id);
        return ResponseEntity.ok(user);
    }

    @PatchMapping("/users/{id}/status")
    public ResponseEntity<AdminUserDto> updateUserStatus(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @PathVariable Long id,
            @Valid @RequestBody UpdateUserStatusRequest request
    ) {
        verifyAdmin(userPrincipal);
        AdminUserDto updated = adminService.updateUserStatus(userPrincipal.getId(), id, request);
        return ResponseEntity.ok(updated);
    }

    @PatchMapping("/users/{id}/role")
    public ResponseEntity<AdminUserDto> updateUserRole(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @PathVariable Long id,
            @Valid @RequestBody UpdateUserRoleRequest request
    ) {
        verifyAdmin(userPrincipal);
        AdminUserDto updated = adminService.updateUserRole(userPrincipal.getId(), id, request);
        return ResponseEntity.ok(updated);
    }

    @GetMapping("/orders")
    public ResponseEntity<List<AdminOrderDto>> getRecentOrders(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @RequestParam(defaultValue = "50") int limit
    ) {
        verifyAdmin(userPrincipal);
        List<AdminOrderDto> orders = adminService.getRecentOrders(limit);
        return ResponseEntity.ok(orders);
    }

    @GetMapping("/transactions")
    public ResponseEntity<List<AdminTransactionDto>> getRecentTransactions(
            @AuthenticationPrincipal UserPrincipal userPrincipal,
            @RequestParam(defaultValue = "50") int limit
    ) {
        verifyAdmin(userPrincipal);
        List<AdminTransactionDto> transactions = adminService.getRecentTransactions(limit);
        return ResponseEntity.ok(transactions);
    }

    private void verifyAdmin(UserPrincipal userPrincipal) {
        if (userPrincipal == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User must be authenticated");
        }
        boolean isAdmin = userPrincipal.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN") || a.getAuthority().equals("ADMIN"));
        if (!isAdmin) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied: User does not have ADMIN privileges");
        }
    }
}
