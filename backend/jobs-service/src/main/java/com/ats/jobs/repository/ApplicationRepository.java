package com.ats.jobs.repository;

import com.ats.jobs.entity.Application;
import com.ats.jobs.enums.ApplicationStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ApplicationRepository extends JpaRepository<Application, UUID> {

    Page<Application> findByJobId(UUID jobId, Pageable pageable);

    List<Application> findByJobIdAndStatus(UUID jobId, ApplicationStatus status);

    Page<Application> findByCandidateAuthUserId(UUID candidateAuthUserId, Pageable pageable);

    long countByJobId(UUID jobId);

    List<Application> findByJobId(UUID jobId);

    /**
     * Return the top-N applications for a job that have already been assigned a
     * ranking position by the AI-orchestrator, ordered by position ascending
     * (rank 1 = best candidate first).
     */
    @Query("SELECT a FROM Application a " +
           "WHERE a.jobId = :jobId " +
           "AND a.rankingPosition IS NOT NULL " +
           "ORDER BY a.rankingPosition ASC")
    List<Application> findRankedByJobId(@Param("jobId") UUID jobId, Pageable pageable);

    List<Application> findByJobIdAndCandidateAuthUserId(UUID jobId, UUID candidateAuthUserId);
}
