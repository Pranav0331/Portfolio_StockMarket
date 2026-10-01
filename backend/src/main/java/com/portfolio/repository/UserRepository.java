package com.portfolio.repository;

import com.portfolio.entity.User;
import com.portfolio.entity.enums.UserStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);
    boolean existsByEmail(String email);
    long countByStatus(UserStatus status);
    List<User> findAllByOrderByCreatedAtDesc();
}

