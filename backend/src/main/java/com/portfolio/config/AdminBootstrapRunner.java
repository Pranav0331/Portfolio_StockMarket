package com.portfolio.config;

import com.portfolio.entity.User;
import com.portfolio.entity.enums.UserRole;
import com.portfolio.repository.UserRepository;
import com.portfolio.service.AuthService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Ensures configured ADMIN_EMAIL user is synchronized with ROLE_ADMIN on application startup.
 */
@Component
public class AdminBootstrapRunner implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(AdminBootstrapRunner.class);

    private final UserRepository userRepository;
    private final AuthService authService;

    public AdminBootstrapRunner(UserRepository userRepository, AuthService authService) {
        this.userRepository = userRepository;
        this.authService = authService;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        String adminEmail = authService.getAdminEmail();
        if (adminEmail != null && !adminEmail.trim().isEmpty()) {
            String normalizedAdminEmail = adminEmail.trim().toLowerCase();
            userRepository.findByEmail(normalizedAdminEmail).ifPresent(user -> {
                if (user.getRole() != UserRole.ROLE_ADMIN) {
                    user.setRole(UserRole.ROLE_ADMIN);
                    userRepository.saveAndFlush(user);
                    log.info("AdminBootstrapRunner: Successfully synchronized and persisted ROLE_ADMIN for user {} in users table", user.getEmail());
                } else {
                    log.info("AdminBootstrapRunner: Admin user {} already has ROLE_ADMIN in users table", user.getEmail());
                }
            });
        }
    }
}
