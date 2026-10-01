package com.portfolio.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.portfolio.dto.admin.*;
import com.portfolio.entity.User;
import com.portfolio.entity.enums.AuthProvider;
import com.portfolio.entity.enums.UserRole;
import com.portfolio.entity.enums.UserStatus;
import com.portfolio.repository.UserRepository;
import com.portfolio.security.jwt.JwtTokenProvider;
import com.portfolio.service.AdminService;
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

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class AdminControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JwtTokenProvider jwtTokenProvider;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private AdminService adminService;

    private User adminUser;
    private User normalUser;
    private String adminJwtToken;
    private String normalJwtToken;

    @BeforeEach
    void setUp() {
        userRepository.deleteAll();

        adminUser = new User("admin@example.com", "System Admin");
        adminUser.setPasswordHash("hashed_admin");
        adminUser.setRole(UserRole.ROLE_ADMIN);
        adminUser.setStatus(UserStatus.ACTIVE);
        adminUser.setProvider(AuthProvider.LOCAL);
        adminUser = userRepository.save(adminUser);

        normalUser = new User("trader@example.com", "Normal Trader");
        normalUser.setPasswordHash("hashed_trader");
        normalUser.setRole(UserRole.ROLE_USER);
        normalUser.setStatus(UserStatus.ACTIVE);
        normalUser.setProvider(AuthProvider.LOCAL);
        normalUser = userRepository.save(normalUser);

        adminJwtToken = jwtTokenProvider.generateToken(com.portfolio.security.UserPrincipal.create(adminUser));
        normalJwtToken = jwtTokenProvider.generateToken(com.portfolio.security.UserPrincipal.create(normalUser));
    }

    @Test
    @DisplayName("GET /api/admin/summary - unauthenticated request returns 401 UNAUTHORIZED")
    void testGetSummary_Unauthenticated() throws Exception {
        mockMvc.perform(get("/api/admin/summary"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("GET /api/admin/summary - normal user (ROLE_USER) returns 403 FORBIDDEN")
    void testGetSummary_NormalUserForbidden() throws Exception {
        mockMvc.perform(get("/api/admin/summary")
                        .header("Authorization", "Bearer " + normalJwtToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("GET /api/admin/summary - admin user (ROLE_ADMIN) returns 200 OK")
    void testGetSummary_AdminSuccess() throws Exception {
        AdminStatsDto stats = new AdminStatsDto(
                50L, 45L, 3L, 2L, 200L, 180L, 75L, 30L, 60L, System.currentTimeMillis()
        );
        AdminDashboardSummaryDto summary = new AdminDashboardSummaryDto(
                stats, List.of(), List.of(), List.of()
        );

        when(adminService.getDashboardSummary()).thenReturn(summary);

        mockMvc.perform(get("/api/admin/summary")
                        .header("Authorization", "Bearer " + adminJwtToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.stats.totalUsers").value(50))
                .andExpect(jsonPath("$.stats.activeUsers").value(45));
    }

    @Test
    @DisplayName("GET /api/admin/users - admin user returns filtered user list")
    void testGetUsers_AdminSuccess() throws Exception {
        AdminUserDto userDto = new AdminUserDto(
                normalUser.getId(), "trader@example.com", "Normal Trader",
                "ROLE_USER", "ACTIVE", "LOCAL",
                System.currentTimeMillis(), System.currentTimeMillis(),
                3, 10, 8, 2, 5, BigDecimal.valueOf(95000.0)
        );

        when(adminService.getUsers(any(), any(), any())).thenReturn(List.of(userDto));

        mockMvc.perform(get("/api/admin/users")
                        .header("Authorization", "Bearer " + adminJwtToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].email").value("trader@example.com"))
                .andExpect(jsonPath("$[0].role").value("ROLE_USER"));
    }

    @Test
    @DisplayName("PATCH /api/admin/users/{id}/status - updates status")
    void testUpdateUserStatus_AdminSuccess() throws Exception {
        UpdateUserStatusRequest request = new UpdateUserStatusRequest("SUSPENDED");

        AdminUserDto updatedDto = new AdminUserDto(
                normalUser.getId(), "trader@example.com", "Normal Trader",
                "ROLE_USER", "SUSPENDED", "LOCAL",
                System.currentTimeMillis(), System.currentTimeMillis(),
                3, 10, 8, 2, 5, BigDecimal.valueOf(95000.0)
        );

        when(adminService.updateUserStatus(eq(adminUser.getId()), eq(normalUser.getId()), any(UpdateUserStatusRequest.class)))
                .thenReturn(updatedDto);

        mockMvc.perform(patch("/api/admin/users/" + normalUser.getId() + "/status")
                        .header("Authorization", "Bearer " + adminJwtToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SUSPENDED"));
    }

    @Test
    @DisplayName("PATCH /api/admin/users/{id}/role - updates role")
    void testUpdateUserRole_AdminSuccess() throws Exception {
        UpdateUserRoleRequest request = new UpdateUserRoleRequest("ROLE_ADMIN");

        AdminUserDto updatedDto = new AdminUserDto(
                normalUser.getId(), "trader@example.com", "Normal Trader",
                "ROLE_ADMIN", "ACTIVE", "LOCAL",
                System.currentTimeMillis(), System.currentTimeMillis(),
                3, 10, 8, 2, 5, BigDecimal.valueOf(95000.0)
        );

        when(adminService.updateUserRole(eq(adminUser.getId()), eq(normalUser.getId()), any(UpdateUserRoleRequest.class)))
                .thenReturn(updatedDto);

        mockMvc.perform(patch("/api/admin/users/" + normalUser.getId() + "/role")
                        .header("Authorization", "Bearer " + adminJwtToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("ROLE_ADMIN"));
    }
}
