package com.portfolio.config;

import com.portfolio.entity.User;
import com.portfolio.entity.enums.UserRole;
import com.portfolio.repository.UserRepository;
import com.portfolio.service.AuthService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AdminBootstrapRunnerTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private AuthService authService;

    @Test
    @DisplayName("AdminBootstrapRunner upgrades existing ROLE_USER to ROLE_ADMIN on startup")
    void testStartupUpgrade() {
        AdminBootstrapRunner runner = new AdminBootstrapRunner(userRepository, authService);

        String adminEmail = "pranavmathur36@gmail.com";
        when(authService.getAdminEmail()).thenReturn(adminEmail);

        User existingUser = new User(adminEmail, "Pranav Mathur");
        existingUser.setRole(UserRole.ROLE_USER);

        when(userRepository.findByEmail(adminEmail)).thenReturn(Optional.of(existingUser));
        when(userRepository.saveAndFlush(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        runner.run(null);

        assertThat(existingUser.getRole()).isEqualTo(UserRole.ROLE_ADMIN);
        verify(userRepository, times(1)).saveAndFlush(existingUser);
    }

    @Test
    @DisplayName("AdminBootstrapRunner does nothing when user already has ROLE_ADMIN")
    void testStartupAlreadyAdmin() {
        AdminBootstrapRunner runner = new AdminBootstrapRunner(userRepository, authService);

        String adminEmail = "pranavmathur36@gmail.com";
        when(authService.getAdminEmail()).thenReturn(adminEmail);

        User existingUser = new User(adminEmail, "Pranav Mathur");
        existingUser.setRole(UserRole.ROLE_ADMIN);

        when(userRepository.findByEmail(adminEmail)).thenReturn(Optional.of(existingUser));

        runner.run(null);

        assertThat(existingUser.getRole()).isEqualTo(UserRole.ROLE_ADMIN);
        verify(userRepository, never()).saveAndFlush(any());
    }
}
