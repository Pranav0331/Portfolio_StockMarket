package com.portfolio.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.portfolio.dto.auth.LoginRequest;
import com.portfolio.dto.auth.RegisterRequest;
import com.portfolio.entity.User;
import com.portfolio.repository.UserRepository;
import com.portfolio.security.jwt.JwtTokenProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class AuthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtTokenProvider jwtTokenProvider;

    @Autowired
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        userRepository.deleteAll();
    }

    @Test
    @DisplayName("1. Successful registration creates user with BCrypt hashed password and returns HTTP 201")
    void testSuccessfulRegistration() throws Exception {
        RegisterRequest request = new RegisterRequest(
                "Jane Doe",
                "jane.doe@example.com",
                "SecurePassword123",
                "SecurePassword123"
        );

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").exists())
                .andExpect(jsonPath("$.name").value("Jane Doe"))
                .andExpect(jsonPath("$.email").value("jane.doe@example.com"))
                .andExpect(jsonPath("$.role").value("ROLE_USER"))
                .andExpect(jsonPath("$.message").value("User registered successfully"))
                .andExpect(jsonPath("$.password").doesNotExist())
                .andExpect(jsonPath("$.passwordHash").doesNotExist());

        // Verify password is encrypted with BCrypt in database
        User savedUser = userRepository.findByEmail("jane.doe@example.com").orElseThrow();
        assertThat(savedUser.getPasswordHash()).isNotEqualTo("SecurePassword123");
        assertThat(passwordEncoder.matches("SecurePassword123", savedUser.getPasswordHash())).isTrue();
    }

    @Test
    @DisplayName("2. Duplicate email registration is rejected with HTTP 409 Conflict")
    void testDuplicateEmailRegistration() throws Exception {
        RegisterRequest request1 = new RegisterRequest(
                "First User",
                "duplicate@example.com",
                "Password123",
                "Password123"
        );

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request1)))
                .andExpect(status().isCreated());

        RegisterRequest duplicateRequest = new RegisterRequest(
                "Second User",
                "duplicate@example.com",
                "DifferentPassword123",
                "DifferentPassword123"
        );

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(duplicateRequest)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.message").value("Email is already registered"));
    }

    @Test
    @DisplayName("3. Password and confirmPassword mismatch is rejected with HTTP 400 Bad Request")
    void testPasswordMismatch() throws Exception {
        RegisterRequest request = new RegisterRequest(
                "Mismatch User",
                "mismatch@example.com",
                "Password123",
                "DifferentPassword123"
        );

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.message").value("Passwords do not match"));
    }

    @Test
    @DisplayName("4. Invalid registration fields fail Bean validation with HTTP 400")
    void testInvalidRegistrationFields() throws Exception {
        RegisterRequest invalidRequest = new RegisterRequest(
                "",
                "not-an-email",
                "123",
                "123"
        );

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(invalidRequest)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.validationErrors.name").exists())
                .andExpect(jsonPath("$.validationErrors.email").exists())
                .andExpect(jsonPath("$.validationErrors.password").exists());
    }

    @Test
    @DisplayName("5. Successful login returns valid JWT token and user info without password")
    void testSuccessfulLogin() throws Exception {
        RegisterRequest register = new RegisterRequest(
                "Login User",
                "login.user@example.com",
                "MyPassword123",
                "MyPassword123"
        );

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(register)))
                .andExpect(status().isCreated());

        LoginRequest login = new LoginRequest("login.user@example.com", "MyPassword123");

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(login)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").exists())
                .andExpect(jsonPath("$.type").value("Bearer"))
                .andExpect(jsonPath("$.email").value("login.user@example.com"))
                .andExpect(jsonPath("$.name").value("Login User"))
                .andExpect(jsonPath("$.role").value("ROLE_USER"))
                .andExpect(jsonPath("$.password").doesNotExist())
                .andExpect(jsonPath("$.passwordHash").doesNotExist());
    }

    @Test
    @DisplayName("6. Login with wrong password returns HTTP 401 Unauthorized")
    void testWrongPasswordLogin() throws Exception {
        RegisterRequest register = new RegisterRequest(
                "Target User",
                "target@example.com",
                "CorrectPassword123",
                "CorrectPassword123"
        );

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(register)))
                .andExpect(status().isCreated());

        LoginRequest login = new LoginRequest("target@example.com", "WrongPassword123");

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(login)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.message").value("Invalid email or password"));
    }

    @Test
    @DisplayName("7. Login with unknown email returns HTTP 401 Unauthorized")
    void testUnknownEmailLogin() throws Exception {
        LoginRequest login = new LoginRequest("unknown@example.com", "SomePassword123");

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(login)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.message").value("Invalid email or password"));
    }

    @Test
    @DisplayName("8. Accessing protected endpoint without JWT returns HTTP 401 Unauthorized")
    void testProtectedEndpointWithoutJwt() throws Exception {
        mockMvc.perform(get("/api/auth/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.message").value("Full authentication is required to access this resource"));
    }

    @Test
    @DisplayName("9. Accessing protected endpoint with invalid JWT returns HTTP 401 Unauthorized")
    void testProtectedEndpointWithInvalidJwt() throws Exception {
        mockMvc.perform(get("/api/auth/me")
                        .header("Authorization", "Bearer invalid.jwt.token"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401));
    }

    @Test
    @DisplayName("10. Accessing protected endpoint with expired JWT returns HTTP 401 Unauthorized")
    void testProtectedEndpointWithExpiredJwt() throws Exception {
        // Generate an expired token (-1000ms expiration)
        String expiredToken = jwtTokenProvider.generateToken(
                "expired@example.com",
                999L,
                "Expired User",
                "ROLE_USER",
                -5000L
        );

        mockMvc.perform(get("/api/auth/me")
                        .header("Authorization", "Bearer " + expiredToken))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401));
    }

    @Test
    @DisplayName("11. Accessing protected endpoint with valid JWT returns HTTP 200 OK with profile")
    void testProtectedEndpointWithValidJwt() throws Exception {
        RegisterRequest register = new RegisterRequest(
                "Auth User",
                "auth.user@example.com",
                "ValidPassword123",
                "ValidPassword123"
        );

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(register)))
                .andExpect(status().isCreated());

        LoginRequest login = new LoginRequest("auth.user@example.com", "ValidPassword123");

        String loginResponse = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(login)))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();

        String token = objectMapper.readTree(loginResponse).get("token").asText();

        mockMvc.perform(get("/api/auth/me")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("auth.user@example.com"))
                .andExpect(jsonPath("$.name").value("Auth User"))
                .andExpect(jsonPath("$.role").value("ROLE_USER"))
                .andExpect(jsonPath("$.status").value("ACTIVE"));
    }

    @Test
    @DisplayName("12. Logout endpoint returns HTTP 200 OK")
    void testLogout() throws Exception {
        mockMvc.perform(post("/api/auth/logout"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Logged out successfully. Please remove the client-side token."));
    }

    @Test
    @DisplayName("13. Health endpoint remains public and accessible without JWT")
    void testHealthEndpointIsPublic() throws Exception {
        mockMvc.perform(get("/api/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));
    }
}
