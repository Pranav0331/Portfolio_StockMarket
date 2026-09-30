package com.portfolio.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

@Entity
@Table(
    name = "upstox_sessions",
    uniqueConstraints = {
        @UniqueConstraint(name = "uk_upstox_session_key", columnNames = {"session_key"})
    }
)
public class UpstoxSession {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "session_key", nullable = false, length = 50, unique = true)
    private String sessionKey = "DEFAULT";

    @JsonIgnore
    @Column(name = "access_token", nullable = false, columnDefinition = "TEXT")
    private String accessToken;

    @JsonIgnore
    @Column(name = "extended_token", columnDefinition = "TEXT")
    private String extendedToken;

    @Column(name = "user_name")
    private String userName;

    @Column(name = "user_id", length = 100)
    private String userId;

    @Column(name = "email")
    private String email;

    @Column(name = "user_type", length = 50)
    private String userType;

    @Column(name = "broker", length = 50)
    private String broker;

    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;

    @Column(name = "connected_at", nullable = false)
    private Long connectedAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public UpstoxSession() {}

    public UpstoxSession(String sessionKey, String accessToken, String extendedToken, String userName,
                         String userId, String email, String userType, String broker,
                         Boolean isActive, Long connectedAt) {
        this.sessionKey = sessionKey;
        this.accessToken = accessToken;
        this.extendedToken = extendedToken;
        this.userName = userName;
        this.userId = userId;
        this.email = email;
        this.userType = userType;
        this.broker = broker;
        this.isActive = isActive;
        this.connectedAt = connectedAt;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getSessionKey() {
        return sessionKey;
    }

    public void setSessionKey(String sessionKey) {
        this.sessionKey = sessionKey;
    }

    public String getAccessToken() {
        return accessToken;
    }

    public void setAccessToken(String accessToken) {
        this.accessToken = accessToken;
    }

    public String getExtendedToken() {
        return extendedToken;
    }

    public void setExtendedToken(String extendedToken) {
        this.extendedToken = extendedToken;
    }

    public String getUserName() {
        return userName;
    }

    public void setUserName(String userName) {
        this.userName = userName;
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getUserType() {
        return userType;
    }

    public void setUserType(String userType) {
        this.userType = userType;
    }

    public String getBroker() {
        return broker;
    }

    public void setBroker(String broker) {
        this.broker = broker;
    }

    public Boolean getIsActive() {
        return isActive;
    }

    public void setIsActive(Boolean isActive) {
        this.isActive = isActive;
    }

    public Long getConnectedAt() {
        return connectedAt;
    }

    public void setConnectedAt(Long connectedAt) {
        this.connectedAt = connectedAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }
}
