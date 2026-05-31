package com.ats.jobs.repository;

import com.ats.jobs.entity.UserIntegration;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserIntegrationRepository extends JpaRepository<UserIntegration, UUID> {
    Optional<UserIntegration> findByAuthUserId(UUID authUserId);
}
