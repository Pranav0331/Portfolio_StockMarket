# ---------------------------------------------------
# Stage 1: Build Stage
# ---------------------------------------------------
FROM eclipse-temurin:21-jdk-alpine AS builder

WORKDIR /build

# Copy Maven wrapper and POM for dependency resolution caching
COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
RUN chmod +x ./mvnw

# Pre-fetch dependencies in a cached layer
RUN ./mvnw dependency:go-offline -B

# Copy application source code
COPY src ./src

# Package application as an executable Spring Boot JAR
RUN ./mvnw clean package -DskipTests

# ---------------------------------------------------
# Stage 2: Production Runtime Stage
# ---------------------------------------------------
FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

# Create a dedicated non-root user and group for security
RUN addgroup -S spring && adduser -S spring -G spring

# Copy the built artifact from builder stage
COPY --from=builder /build/target/*.jar app.jar
RUN chown -R spring:spring /app

USER spring:spring

# Default environment configuration (Render injects PORT dynamically)
ENV PORT=8080
EXPOSE ${PORT}

# Run the Spring Boot application listening on Render's dynamic PORT with container-aware JVM settings
ENTRYPOINT ["sh", "-c", "java -XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0 -Dserver.port=${PORT} -jar app.jar"]
