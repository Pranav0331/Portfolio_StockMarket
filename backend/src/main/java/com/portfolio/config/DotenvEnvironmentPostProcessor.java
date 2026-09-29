package com.portfolio.config;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;

import java.io.BufferedReader;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Automatically loads .env key-value pairs into the Spring Boot Environment during startup.
 */
public class DotenvEnvironmentPostProcessor implements EnvironmentPostProcessor {

    private static final List<Path> CANDIDATE_PATHS = List.of(
            Paths.get(".env"),
            Paths.get("../.env"),
            Paths.get("backend/.env")
    );

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        for (Path candidate : CANDIDATE_PATHS) {
            if (Files.isRegularFile(candidate) && Files.isReadable(candidate)) {
                Map<String, Object> envProperties = loadDotenvFile(candidate);
                if (!envProperties.isEmpty()) {
                    environment.getPropertySources().addLast(
                            new MapPropertySource("dotenvProperties[" + candidate.getFileName() + "]", envProperties)
                    );
                    break;
                }
            }
        }
    }

    private Map<String, Object> loadDotenvFile(Path path) {
        Map<String, Object> properties = new HashMap<>();
        try (BufferedReader reader = Files.newBufferedReader(path, StandardCharsets.UTF_8)) {
            String line;
            while ((line = reader.readLine()) != null) {
                line = line.trim();
                if (line.isEmpty() || line.startsWith("#")) {
                    continue;
                }
                int equalsIndex = line.indexOf('=');
                if (equalsIndex > 0) {
                    String key = line.substring(0, equalsIndex).trim();
                    String value = line.substring(equalsIndex + 1).trim();

                    if ((value.startsWith("\"") && value.endsWith("\"")) ||
                        (value.startsWith("'") && value.endsWith("'"))) {
                        if (value.length() >= 2) {
                            value = value.substring(1, value.length() - 1);
                        }
                    }
                    properties.put(key, value);
                }
            }
        } catch (IOException ignored) {
            // Ignore if file cannot be read
        }
        return properties;
    }
}
