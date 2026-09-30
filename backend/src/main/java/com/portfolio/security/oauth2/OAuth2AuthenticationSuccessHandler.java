package com.portfolio.security.oauth2;

import com.portfolio.security.UserPrincipal;
import com.portfolio.security.jwt.JwtTokenProvider;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

@Component
public class OAuth2AuthenticationSuccessHandler extends SimpleUrlAuthenticationSuccessHandler {

    private static final Logger log = LoggerFactory.getLogger(OAuth2AuthenticationSuccessHandler.class);

    private final JwtTokenProvider tokenProvider;
    private final CustomOAuth2UserService customOAuth2UserService;
    private final HttpCookieOAuth2AuthorizationRequestRepository cookieAuthorizationRequestRepository;

    @Value("${app.oauth2.authorized-redirect-uri:http://localhost:4200/oauth2/redirect}")
    private String redirectUri;

    public OAuth2AuthenticationSuccessHandler(
            JwtTokenProvider tokenProvider,
            CustomOAuth2UserService customOAuth2UserService,
            HttpCookieOAuth2AuthorizationRequestRepository cookieAuthorizationRequestRepository
    ) {
        this.tokenProvider = tokenProvider;
        this.customOAuth2UserService = customOAuth2UserService;
        this.cookieAuthorizationRequestRepository = cookieAuthorizationRequestRepository;
    }

    @Override
    public void onAuthenticationSuccess(
            HttpServletRequest request,
            HttpServletResponse response,
            Authentication authentication
    ) throws IOException {
        String targetUrl = determineTargetUrl(request, response, authentication);

        if (response.isCommitted()) {
            log.debug("Response has already been committed. Unable to redirect to " + targetUrl);
            return;
        }

        clearAuthenticationAttributes(request, response);
        getRedirectStrategy().sendRedirect(request, response, targetUrl);
    }

    protected void clearAuthenticationAttributes(HttpServletRequest request, HttpServletResponse response) {
        super.clearAuthenticationAttributes(request);
        cookieAuthorizationRequestRepository.removeAuthorizationRequestCookies(request, response);
    }

    protected String determineTargetUrl(
            HttpServletRequest request,
            HttpServletResponse response,
            Authentication authentication
    ) {
        UserPrincipal userPrincipal = resolveUserPrincipal(authentication);
        String token = tokenProvider.generateToken(userPrincipal);

        String role = userPrincipal.getAuthorities().isEmpty() ? "ROLE_USER" :
                userPrincipal.getAuthorities().iterator().next().getAuthority();

        return UriComponentsBuilder.fromUriString(redirectUri)
                .queryParam("token", token)
                .queryParam("id", userPrincipal.getId())
                .queryParam("email", userPrincipal.getEmail())
                .queryParam("name", userPrincipal.getFullName())
                .queryParam("role", role)
                .build()
                .encode(StandardCharsets.UTF_8)
                .toUriString();
    }

    private UserPrincipal resolveUserPrincipal(Authentication authentication) {
        Object principal = authentication.getPrincipal();
        if (principal instanceof UserPrincipal userPrincipal) {
            return userPrincipal;
        } else if (principal instanceof org.springframework.security.oauth2.core.user.OAuth2User oAuth2User) {
            org.springframework.security.oauth2.core.user.OAuth2User processedUser =
                    customOAuth2UserService.processOAuth2User(null, oAuth2User);
            if (processedUser instanceof UserPrincipal userPrincipal) {
                return userPrincipal;
            }
        }
        throw new IllegalStateException("Unable to resolve UserPrincipal from authentication principal of type: " +
                (principal != null ? principal.getClass().getName() : "null"));
    }
}
