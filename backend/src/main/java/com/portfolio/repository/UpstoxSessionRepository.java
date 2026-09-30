package com.portfolio.repository;

import com.portfolio.entity.UpstoxSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UpstoxSessionRepository extends JpaRepository<UpstoxSession, Long> {

    Optional<UpstoxSession> findBySessionKey(String sessionKey);

    Optional<UpstoxSession> findFirstByIsActiveTrueOrderByUpdatedAtDesc();
}
