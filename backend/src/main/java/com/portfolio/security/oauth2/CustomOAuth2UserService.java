package com.portfolio.security.oauth2;

import com.portfolio.entity.User;
import com.portfolio.entity.enums.AuthProvider;
import com.portfolio.entity.enums.UserRole;
import com.portfolio.entity.enums.UserStatus;
import com.portfolio.repository.UserRepository;
import com.portfolio.security.UserPrincipal;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.authentication.InternalAuthenticationServiceException;
import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.Optional;

@Service
public class CustomOAuth2UserService extends DefaultOAuth2UserService {

    private static final Logger log = LoggerFactory.getLogger(CustomOAuth2UserService.class);

    private final UserRepository userRepository;
    private final String adminEmail;

    public CustomOAuth2UserService(
            UserRepository userRepository,
            @org.springframework.beans.factory.annotation.Value("${app.admin.email:}") String adminEmail
    ) {
        this.userRepository = userRepository;
        this.adminEmail = adminEmail;
    }

    private boolean isAdminEmail(String email) {
        if (adminEmail == null || adminEmail.trim().isEmpty() || email == null || email.trim().isEmpty()) {
            return false;
        }
        return adminEmail.trim().equalsIgnoreCase(email.trim());
    }

    @Override
    @Transactional
    public OAuth2User loadUser(OAuth2UserRequest userRequest) throws OAuth2AuthenticationException {
        OAuth2User oAuth2User = super.loadUser(userRequest);

        try {
            return processOAuth2User(userRequest, oAuth2User);
        } catch (Exception ex) {
            log.error("Error processing OAuth2 user: {}", ex.getMessage());
            throw new InternalAuthenticationServiceException(ex.getMessage(), ex);
        }
    }

    @Transactional
    public OAuth2User processOAuth2User(OAuth2UserRequest userRequest, OAuth2User oAuth2User) {
        String email = (String) oAuth2User.getAttributes().get("email");
        String name = (String) oAuth2User.getAttributes().get("name");
        String sub = (String) oAuth2User.getAttributes().get("sub");

        if (!StringUtils.hasText(email)) {
            throw new IllegalArgumentException("Email not found from OAuth2 provider");
        }

        String normalizedEmail = email.trim().toLowerCase();
        Optional<User> userOptional = userRepository.findByEmail(normalizedEmail);
        User user;

        if (userOptional.isPresent()) {
            user = userOptional.get();
            // Re-use existing user and update provider info if needed
            if (user.getProvider() == null || user.getProvider() == AuthProvider.LOCAL) {
                user.setProvider(AuthProvider.GOOGLE);
            }
            if (StringUtils.hasText(sub)) {
                user.setProviderId(sub);
            }
            if (!StringUtils.hasText(user.getFullName()) && StringUtils.hasText(name)) {
                user.setFullName(name);
            }
            // If configured admin email matches and user is currently ROLE_USER, upgrade to ROLE_ADMIN
            if (isAdminEmail(normalizedEmail) && user.getRole() != UserRole.ROLE_ADMIN) {
                user.setRole(UserRole.ROLE_ADMIN);
                log.info("Upgraded existing OAuth user {} to ROLE_ADMIN based on ADMIN_EMAIL configuration", user.getEmail());
            }
            user = userRepository.save(user);
            log.info("Existing user {} authenticated via Google OAuth", user.getEmail());
        } else {
            // Register new Google user
            user = new User();
            user.setEmail(normalizedEmail);
            user.setFullName(StringUtils.hasText(name) ? name.trim() : "Google User");
            UserRole assignedRole = isAdminEmail(normalizedEmail) ? UserRole.ROLE_ADMIN : UserRole.ROLE_USER;
            user.setRole(assignedRole);
            user.setStatus(UserStatus.ACTIVE);
            user.setProvider(AuthProvider.GOOGLE);
            user.setProviderId(sub);
            user.setPasswordHash(null); // No password for Google OAuth users

            user = userRepository.save(user);
            log.info("Registered new user {} via Google OAuth with role {}", user.getEmail(), assignedRole);
        }

        return UserPrincipal.create(user, oAuth2User.getAttributes());
    }
}
