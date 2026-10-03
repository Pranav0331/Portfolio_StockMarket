package com.portfolio.service;

import com.portfolio.dto.auth.AuthResponse;
import com.portfolio.dto.auth.LoginRequest;
import com.portfolio.dto.auth.RegisterRequest;
import com.portfolio.entity.User;
import com.portfolio.entity.enums.UserRole;
import com.portfolio.entity.enums.UserStatus;
import com.portfolio.repository.UserRepository;
import com.portfolio.security.jwt.JwtTokenProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private JwtTokenProvider jwtTokenProvider;

    private AuthService authServiceWithAdmin;
    private AuthService authServiceWithoutAdmin;

    private static final String ADMIN_EMAIL = "superadmin@domain.com";

    @BeforeEach
    void setUp() {
        authServiceWithAdmin = new AuthService(
                userRepository,
                passwordEncoder,
                jwtTokenProvider,
                null,
                ADMIN_EMAIL
        );

        authServiceWithoutAdmin = new AuthService(
                userRepository,
                passwordEncoder,
                jwtTokenProvider,
                null,
                ""
        );
    }

    @Test
    @DisplayName("Registration - user matching ADMIN_EMAIL is assigned ROLE_ADMIN")
    void testRegister_MatchingAdminEmail_AssignsRoleAdmin() {
        when(userRepository.existsByEmail(ADMIN_EMAIL)).thenReturn(false);
        when(passwordEncoder.encode("Secret123")).thenReturn("hashedSecret");

        ArgumentCaptor<User> userCaptor = ArgumentCaptor.forClass(User.class);
        when(userRepository.saveAndFlush(userCaptor.capture())).thenAnswer(invocation -> {
            User u = invocation.getArgument(0);
            u.setId(10L);
            return u;
        });

        RegisterRequest request = new RegisterRequest("Admin Master", ADMIN_EMAIL, "Secret123", "Secret123");
        AuthResponse response = authServiceWithAdmin.register(request);

        User saved = userCaptor.getValue();
        assertThat(saved.getRole()).isEqualTo(UserRole.ROLE_ADMIN);
        assertThat(response.role()).isEqualTo("ROLE_ADMIN");
    }

    @Test
    @DisplayName("Registration - user not matching ADMIN_EMAIL is assigned ROLE_USER")
    void testRegister_NonMatchingEmail_AssignsRoleUser() {
        String normalEmail = "trader@domain.com";
        when(userRepository.existsByEmail(normalEmail)).thenReturn(false);
        when(passwordEncoder.encode("Secret123")).thenReturn("hashedSecret");

        ArgumentCaptor<User> userCaptor = ArgumentCaptor.forClass(User.class);
        when(userRepository.saveAndFlush(userCaptor.capture())).thenAnswer(invocation -> {
            User u = invocation.getArgument(0);
            u.setId(11L);
            return u;
        });

        RegisterRequest request = new RegisterRequest("Normal Trader", normalEmail, "Secret123", "Secret123");
        AuthResponse response = authServiceWithAdmin.register(request);

        User saved = userCaptor.getValue();
        assertThat(saved.getRole()).isEqualTo(UserRole.ROLE_USER);
        assertThat(response.role()).isEqualTo("ROLE_USER");
    }

    @Test
    @DisplayName("Login - existing user matching ADMIN_EMAIL is upgraded from ROLE_USER to ROLE_ADMIN")
    void testLogin_UpgradesExistingUserToRoleAdmin() {
        User existingUser = new User(ADMIN_EMAIL, "Admin Person");
        existingUser.setId(1L);
        existingUser.setPasswordHash("hashedPass");
        existingUser.setStatus(UserStatus.ACTIVE);
        existingUser.setRole(UserRole.ROLE_USER);

        when(userRepository.findByEmail(ADMIN_EMAIL)).thenReturn(Optional.of(existingUser));
        when(passwordEncoder.matches("Pass123", "hashedPass")).thenReturn(true);
        when(userRepository.saveAndFlush(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(jwtTokenProvider.generateToken(any())).thenReturn("mock-jwt-token");

        LoginRequest request = new LoginRequest(ADMIN_EMAIL, "Pass123");
        AuthResponse response = authServiceWithAdmin.login(request);

        assertThat(existingUser.getRole()).isEqualTo(UserRole.ROLE_ADMIN);
        assertThat(response.role()).isEqualTo("ROLE_ADMIN");
        verify(userRepository, times(1)).saveAndFlush(existingUser);
    }

    @Test
    @DisplayName("Login - regular user remains ROLE_USER without upgrade")
    void testLogin_RegularUserRemainsRoleUser() {
        String normalEmail = "trader@domain.com";
        User normalUser = new User(normalEmail, "Trader Joe");
        normalUser.setId(2L);
        normalUser.setPasswordHash("hashedPass");
        normalUser.setStatus(UserStatus.ACTIVE);
        normalUser.setRole(UserRole.ROLE_USER);

        when(userRepository.findByEmail(normalEmail)).thenReturn(Optional.of(normalUser));
        when(passwordEncoder.matches("Pass123", "hashedPass")).thenReturn(true);
        when(jwtTokenProvider.generateToken(any())).thenReturn("mock-jwt-token");

        LoginRequest request = new LoginRequest(normalEmail, "Pass123");
        AuthResponse response = authServiceWithAdmin.login(request);

        assertThat(normalUser.getRole()).isEqualTo(UserRole.ROLE_USER);
        assertThat(response.role()).isEqualTo("ROLE_USER");
        verify(userRepository, never()).saveAndFlush(any());
    }
}
