package com.portfolio.security.oauth2;

import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;

import static org.assertj.core.api.Assertions.assertThat;

class HttpCookieOAuth2AuthorizationRequestRepositoryTest {

    private HttpCookieOAuth2AuthorizationRequestRepository repository;

    @BeforeEach
    void setUp() {
        repository = new HttpCookieOAuth2AuthorizationRequestRepository();
    }

    private OAuth2AuthorizationRequest createSampleAuthorizationRequest() {
        return OAuth2AuthorizationRequest.authorizationCode()
                .authorizationUri("https://accounts.google.com/o/oauth2/v2/auth")
                .clientId("test-google-client-id")
                .redirectUri("http://localhost:8080/login/oauth2/code/google")
                .scopes(java.util.Set.of("openid", "profile", "email"))
                .state("secure-random-state-12345")
                .build();
    }

    @Test
    @DisplayName("1. Save authorization request sets HTTP-only, SameSite=Lax cookie")
    void testSaveAuthorizationRequest() {
        OAuth2AuthorizationRequest authRequest = createSampleAuthorizationRequest();
        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();

        repository.saveAuthorizationRequest(authRequest, request, response);

        String setCookieHeader = response.getHeader("Set-Cookie");
        assertThat(setCookieHeader).isNotNull();
        assertThat(setCookieHeader).contains(HttpCookieOAuth2AuthorizationRequestRepository.OAUTH2_AUTHORIZATION_REQUEST_COOKIE_NAME);
        assertThat(setCookieHeader).contains("HttpOnly");
        assertThat(setCookieHeader).contains("SameSite=Lax");
        assertThat(setCookieHeader).contains("Max-Age=180");
        assertThat(setCookieHeader).contains("Path=/");
    }

    @Test
    @DisplayName("2. Load authorization request deserializes valid cookie accurately")
    void testLoadAuthorizationRequest() {
        OAuth2AuthorizationRequest originalRequest = createSampleAuthorizationRequest();
        MockHttpServletRequest saveRequest = new MockHttpServletRequest();
        MockHttpServletResponse saveResponse = new MockHttpServletResponse();

        repository.saveAuthorizationRequest(originalRequest, saveRequest, saveResponse);

        // Extract cookie value from response header
        String setCookieHeader = saveResponse.getHeader("Set-Cookie");
        String cookieValue = setCookieHeader.split(";")[0].split("=")[1];

        MockHttpServletRequest loadRequest = new MockHttpServletRequest();
        loadRequest.setCookies(new Cookie(HttpCookieOAuth2AuthorizationRequestRepository.OAUTH2_AUTHORIZATION_REQUEST_COOKIE_NAME, cookieValue));

        OAuth2AuthorizationRequest loadedRequest = repository.loadAuthorizationRequest(loadRequest);

        assertThat(loadedRequest).isNotNull();
        assertThat(loadedRequest.getClientId()).isEqualTo("test-google-client-id");
        assertThat(loadedRequest.getAuthorizationUri()).isEqualTo("https://accounts.google.com/o/oauth2/v2/auth");
        assertThat(loadedRequest.getRedirectUri()).isEqualTo("http://localhost:8080/login/oauth2/code/google");
        assertThat(loadedRequest.getState()).isEqualTo("secure-random-state-12345");
        assertThat(loadedRequest.getScopes()).containsExactlyInAnyOrder("openid", "profile", "email");
    }

    @Test
    @DisplayName("3. Remove authorization request returns the request and clears cookie with maxAge=0")
    void testRemoveAuthorizationRequest() {
        OAuth2AuthorizationRequest originalRequest = createSampleAuthorizationRequest();
        MockHttpServletRequest saveRequest = new MockHttpServletRequest();
        MockHttpServletResponse saveResponse = new MockHttpServletResponse();

        repository.saveAuthorizationRequest(originalRequest, saveRequest, saveResponse);

        String setCookieHeader = saveResponse.getHeader("Set-Cookie");
        String cookieValue = setCookieHeader.split(";")[0].split("=")[1];

        MockHttpServletRequest removeRequest = new MockHttpServletRequest();
        removeRequest.setCookies(new Cookie(HttpCookieOAuth2AuthorizationRequestRepository.OAUTH2_AUTHORIZATION_REQUEST_COOKIE_NAME, cookieValue));
        MockHttpServletResponse removeResponse = new MockHttpServletResponse();

        OAuth2AuthorizationRequest removedRequest = repository.removeAuthorizationRequest(removeRequest, removeResponse);

        assertThat(removedRequest).isNotNull();
        assertThat(removedRequest.getState()).isEqualTo("secure-random-state-12345");

        String clearCookieHeader = removeResponse.getHeader("Set-Cookie");
        assertThat(clearCookieHeader).isNotNull();
        assertThat(clearCookieHeader).contains("Max-Age=0");
    }

    @Test
    @DisplayName("4. Load authorization request returns null when cookie is absent or malformed")
    void testLoadAuthorizationRequestAbsentOrMalformed() {
        MockHttpServletRequest emptyRequest = new MockHttpServletRequest();
        assertThat(repository.loadAuthorizationRequest(emptyRequest)).isNull();

        MockHttpServletRequest malformedRequest = new MockHttpServletRequest();
        malformedRequest.setCookies(new Cookie(HttpCookieOAuth2AuthorizationRequestRepository.OAUTH2_AUTHORIZATION_REQUEST_COOKIE_NAME, "invalid-garbage-value"));
        assertThat(repository.loadAuthorizationRequest(malformedRequest)).isNull();
    }
}
