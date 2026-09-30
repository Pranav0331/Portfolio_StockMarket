package com.portfolio.security.oauth2;

import com.portfolio.entity.User;
import com.portfolio.entity.enums.AuthProvider;
import com.portfolio.entity.enums.UserRole;
import com.portfolio.entity.enums.UserStatus;
import com.portfolio.repository.UserRepository;
import com.portfolio.security.UserPrincipal;
import com.portfolio.security.jwt.JwtTokenProvider;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.user.DefaultOAuth2User;
import org.springframework.security.oauth2.core.user.OAuth2User;

import java.util.Collections;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
class OAuth2AuthenticationTest {

    @Autowired
    private CustomOAuth2UserService customOAuth2UserService;

    @Autowired
    private OAuth2AuthenticationSuccessHandler successHandler;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JwtTokenProvider jwtTokenProvider;

    @BeforeEach
    void setUp() {
        userRepository.deleteAll();
    }

    @Test
    @DisplayName("1. Google OAuth creates new user with default ROLE_USER and null password")
    void testGoogleUserCreation() {
        Map<String, Object> attributes = Map.of(
                "email", "google.user@gmail.com",
                "name", "Google Explorer",
                "sub", "google-sub-123456"
        );

        OAuth2User rawOAuth2User = new DefaultOAuth2User(
                Collections.emptyList(),
                attributes,
                "email"
        );

        OAuth2User processedUser = customOAuth2UserService.processOAuth2User(null, rawOAuth2User);

        assertThat(processedUser).isInstanceOf(UserPrincipal.class);
        UserPrincipal principal = (UserPrincipal) processedUser;

        assertThat(principal.getEmail()).isEqualTo("google.user@gmail.com");
        assertThat(principal.getFullName()).isEqualTo("Google Explorer");

        Optional<User> savedUserOpt = userRepository.findByEmail("google.user@gmail.com");
        assertThat(savedUserOpt).isPresent();
        User savedUser = savedUserOpt.get();

        assertThat(savedUser.getProvider()).isEqualTo(AuthProvider.GOOGLE);
        assertThat(savedUser.getProviderId()).isEqualTo("google-sub-123456");
        assertThat(savedUser.getRole()).isEqualTo(UserRole.ROLE_USER);
        assertThat(savedUser.getStatus()).isEqualTo(UserStatus.ACTIVE);
        assertThat(savedUser.getPasswordHash()).isNull();
    }

    @Test
    @DisplayName("2. Existing local user logging in with Google does not create duplicate user")
    void testExistingUserGoogleLinking() {
        User existingUser = new User("investor@gmail.com", "Original Name");
        existingUser.setPasswordHash("$2a$10$hashedpassword");
        existingUser.setRole(UserRole.ROLE_USER);
        existingUser.setStatus(UserStatus.ACTIVE);
        existingUser.setProvider(AuthProvider.LOCAL);
        userRepository.save(existingUser);

        long countBefore = userRepository.count();

        Map<String, Object> attributes = Map.of(
                "email", "investor@gmail.com",
                "name", "Google Name",
                "sub", "google-sub-789012"
        );

        OAuth2User rawOAuth2User = new DefaultOAuth2User(
                Collections.emptyList(),
                attributes,
                "email"
        );

        OAuth2User processedUser = customOAuth2UserService.processOAuth2User(null, rawOAuth2User);

        assertThat(userRepository.count()).isEqualTo(countBefore);
        User userInDb = userRepository.findByEmail("investor@gmail.com").orElseThrow();
        assertThat(userInDb.getProvider()).isEqualTo(AuthProvider.GOOGLE);
        assertThat(userInDb.getProviderId()).isEqualTo("google-sub-789012");
        assertThat(userInDb.getPasswordHash()).isEqualTo("$2a$10$hashedpassword"); // Preserves local password hash
    }

    @Test
    @DisplayName("3. Success handler generates valid JWT and redirects with auth parameters")
    void testSuccessHandlerGeneratesJwtAndRedirects() throws Exception {
        User user = new User("oauth.redirect@gmail.com", "OAuth Redirect User");
        user.setRole(UserRole.ROLE_USER);
        user.setStatus(UserStatus.ACTIVE);
        user.setProvider(AuthProvider.GOOGLE);
        User savedUser = userRepository.save(user);

        UserPrincipal principal = UserPrincipal.create(savedUser);
        Authentication authentication = new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities());

        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();

        successHandler.onAuthenticationSuccess(request, response, authentication);

        String redirectedUrl = response.getRedirectedUrl();
        assertThat(redirectedUrl).isNotNull();
        assertThat(redirectedUrl).startsWith("http://localhost:4200/oauth2/redirect");
        assertThat(redirectedUrl).contains("token=");
        assertThat(redirectedUrl).contains("email=" + savedUser.getEmail());
        assertThat(redirectedUrl).contains("role=ROLE_USER");

        // Extract token from query parameter and verify
        String tokenParam = redirectedUrl.split("token=")[1].split("&")[0];
        assertThat(jwtTokenProvider.validateToken(tokenParam)).isTrue();
        assertThat(jwtTokenProvider.getEmailFromToken(tokenParam)).isEqualTo("oauth.redirect@gmail.com");
    }

    @Test
    @DisplayName("4. Success handler handles DefaultOidcUser (Google OIDC flow), provisions user, and redirects with valid JWT")
    void testSuccessHandlerWithDefaultOidcUser() throws Exception {
        Map<String, Object> claims = Map.of(
                "sub", "google-oidc-sub-9999",
                "email", "oidc.user@gmail.com",
                "name", "Google OIDC Explorer"
        );
        org.springframework.security.oauth2.core.oidc.OidcIdToken idToken =
                new org.springframework.security.oauth2.core.oidc.OidcIdToken(
                        "mock-id-token-value",
                        java.time.Instant.now(),
                        java.time.Instant.now().plusSeconds(3600),
                        claims
                );
        org.springframework.security.oauth2.core.oidc.OidcUserInfo userInfo =
                new org.springframework.security.oauth2.core.oidc.OidcUserInfo(claims);
        org.springframework.security.oauth2.core.oidc.user.DefaultOidcUser oidcUser =
                new org.springframework.security.oauth2.core.oidc.user.DefaultOidcUser(
                        Collections.emptyList(),
                        idToken,
                        userInfo,
                        "email"
                );

        org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken authentication =
                new org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken(
                        oidcUser,
                        Collections.emptyList(),
                        "google"
                );

        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();

        successHandler.onAuthenticationSuccess(request, response, authentication);

        String redirectedUrl = response.getRedirectedUrl();
        assertThat(redirectedUrl).isNotNull();
        assertThat(redirectedUrl).startsWith("http://localhost:4200/oauth2/redirect");
        assertThat(redirectedUrl).contains("token=");
        assertThat(redirectedUrl).contains("email=oidc.user@gmail.com");
        assertThat(redirectedUrl).contains("role=ROLE_USER");

        Optional<User> savedUserOpt = userRepository.findByEmail("oidc.user@gmail.com");
        assertThat(savedUserOpt).isPresent();
        assertThat(savedUserOpt.get().getProviderId()).isEqualTo("google-oidc-sub-9999");
    }
}
