package com.portfolio.service;

import com.portfolio.dto.auth.*;
import com.portfolio.entity.User;
import com.portfolio.entity.enums.UserRole;
import com.portfolio.entity.enums.UserStatus;
import com.portfolio.repository.UserRepository;
import com.portfolio.security.UserPrincipal;
import com.portfolio.security.jwt.JwtTokenProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final String adminEmail;

    public AuthService(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            JwtTokenProvider jwtTokenProvider,
            @org.springframework.beans.factory.annotation.Value("${app.admin.email:}") String adminEmail
    ) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtTokenProvider = jwtTokenProvider;
        this.adminEmail = adminEmail;
    }

    public boolean isAdminEmail(String email) {
        if (adminEmail == null || adminEmail.trim().isEmpty() || email == null || email.trim().isEmpty()) {
            return false;
        }
        return adminEmail.trim().equalsIgnoreCase(email.trim());
    }

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (!request.password().equals(request.confirmPassword())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Passwords do not match");
        }

        String normalizedEmail = request.email().trim().toLowerCase();

        if (userRepository.existsByEmail(normalizedEmail)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email is already registered");
        }

        String hashedPassword = passwordEncoder.encode(request.password());

        User user = new User();
        user.setFullName(request.name().trim());
        user.setEmail(normalizedEmail);
        user.setPasswordHash(hashedPassword);
        UserRole assignedRole = isAdminEmail(normalizedEmail) ? UserRole.ROLE_ADMIN : UserRole.ROLE_USER;
        user.setRole(assignedRole);
        user.setStatus(UserStatus.ACTIVE);

        User savedUser = userRepository.save(user);

        log.info("Successfully registered new user with ID: {} and role: {}", savedUser.getId(), savedUser.getRole());

        return new AuthResponse(
                savedUser.getId(),
                savedUser.getFullName(),
                savedUser.getEmail(),
                savedUser.getRole().name(),
                "User registered successfully"
        );
    }

    @Transactional
    public AuthResponse login(LoginRequest request) {
        String normalizedEmail = request.email().trim().toLowerCase();

        User user = userRepository.findByEmail(normalizedEmail)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid email or password"));

        if (user.getPasswordHash() == null || !passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid email or password");
        }

        if (user.getStatus() != UserStatus.ACTIVE) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Account is " + user.getStatus().name().toLowerCase());
        }

        // If configured admin email matches and user is currently ROLE_USER, upgrade to ROLE_ADMIN
        if (isAdminEmail(normalizedEmail) && user.getRole() != UserRole.ROLE_ADMIN) {
            user.setRole(UserRole.ROLE_ADMIN);
            user = userRepository.save(user);
            log.info("Upgraded existing user {} to ROLE_ADMIN based on ADMIN_EMAIL configuration", user.getEmail());
        }

        UserPrincipal principal = UserPrincipal.create(user);
        String token = jwtTokenProvider.generateToken(principal);

        log.info("User {} successfully logged in", user.getEmail());

        return new AuthResponse(
                token,
                user.getId(),
                user.getFullName(),
                user.getEmail(),
                user.getRole().name(),
                "Authentication successful"
        );
    }

    public LogoutResponse logout() {
        return new LogoutResponse("Logged out successfully. Please remove the client-side token.");
    }

    @Transactional(readOnly = true)
    public UserProfileResponse getCurrentUser(UserPrincipal principal) {
        User user = userRepository.findById(principal.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        return new UserProfileResponse(
                user.getId(),
                user.getFullName(),
                user.getEmail(),
                user.getRole().name(),
                user.getStatus().name()
        );
    }
}
