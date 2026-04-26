package com.ats.jobs.repository;

import com.ats.jobs.entity.RecruiterIntegration;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface RecruiterIntegrationRepository extends JpaRepository<RecruiterIntegration, UUID> {
    Optional<RecruiterIntegration> findByRecruiterAuthUserId(UUID recruiterAuthUserId);
}
