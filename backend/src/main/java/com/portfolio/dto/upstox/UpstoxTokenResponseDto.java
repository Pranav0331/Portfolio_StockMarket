package com.portfolio.dto.upstox;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public class UpstoxTokenResponseDto {

    private String email;

    @JsonProperty("user_name")
    private String userName;

    @JsonProperty("user_id")
    private String userId;

    @JsonProperty("user_type")
    private String userType;

    @JsonProperty("access_token")
    private String accessToken;

    @JsonProperty("extended_token")
    private String extendedToken;

    @JsonProperty("is_active")
    private Boolean isActive;

    private List<String> exchanges;
    private List<String> products;
    private String broker;

    public UpstoxTokenResponseDto() {}

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
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

    public String getUserType() {
        return userType;
    }

    public void setUserType(String userType) {
        this.userType = userType;
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

    public Boolean getIsActive() {
        return isActive;
    }

    public void setIsActive(Boolean isActive) {
        this.isActive = isActive;
    }

    public List<String> getExchanges() {
        return exchanges;
    }

    public void setExchanges(List<String> exchanges) {
        this.exchanges = exchanges;
    }

    public List<String> getProducts() {
        return products;
    }

    public void setProducts(List<String> products) {
        this.products = products;
    }

    public String getBroker() {
        return broker;
    }

    public void setBroker(String broker) {
        this.broker = broker;
    }

    @Override
    public String toString() {
        return "UpstoxTokenResponseDto{" +
                "userId='" + userId + '\'' +
                ", userName='" + userName + '\'' +
                ", email='" + email + '\'' +
                ", isActive=" + isActive +
                '}';
    }
}
