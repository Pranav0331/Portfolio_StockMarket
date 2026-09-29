package com.portfolio.config;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.SpringApplication;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.StandardEnvironment;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;

class DotenvEnvironmentPostProcessorTest {

    @Test
    @DisplayName("DotenvEnvironmentPostProcessor parses .env key-values into Environment")
    void testDotenvParsing() throws IOException {
        Path tempEnv = Files.createTempFile(".env", "test");
        try {
            Files.writeString(tempEnv, """
                    # Test Database Configuration
                    MYSQL_URL=jdbc:mysql://localhost:3306/portfolio_stockmarket
                    MYSQL_USERNAME=test_user
                    MYSQL_PASSWORD="test_secret_password"
                    """);

            DotenvEnvironmentPostProcessor processor = new DotenvEnvironmentPostProcessor();
            ConfigurableEnvironment environment = new StandardEnvironment();

            // Invoke private or test with temp file through method logic
            var map = processor.getClass().getDeclaredMethod("loadDotenvFile", Path.class);
            map.setAccessible(true);
            @SuppressWarnings("unchecked")
            var properties = (java.util.Map<String, Object>) map.invoke(processor, tempEnv);

            assertThat(properties.get("MYSQL_URL")).isEqualTo("jdbc:mysql://localhost:3306/portfolio_stockmarket");
            assertThat(properties.get("MYSQL_USERNAME")).isEqualTo("test_user");
            assertThat(properties.get("MYSQL_PASSWORD")).isEqualTo("test_secret_password");
        } catch (Exception e) {
            throw new RuntimeException(e);
        } finally {
            Files.deleteIfExists(tempEnv);
        }
    }
}
