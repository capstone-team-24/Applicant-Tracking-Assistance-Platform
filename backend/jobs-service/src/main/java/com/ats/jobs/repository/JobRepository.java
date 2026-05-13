package com.ats.jobs.repository;

import com.ats.jobs.entity.Job;
import com.ats.jobs.enums.JobStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Repository
public interface JobRepository extends JpaRepository<Job, UUID>, JpaSpecificationExecutor<Job> {

    Page<Job> findByOrgId(UUID orgId, Pageable pageable);

    Page<Job> findByStatus(JobStatus status, Pageable pageable);

    Page<Job> findByOrgIdAndStatus(UUID orgId, JobStatus status, Pageable pageable);

    // ── Recruiter-scoped queries (assigned-to filter) ──────────────────────

    Page<Job> findByAssignedTo(UUID assignedTo, Pageable pageable);

    Page<Job> findByAssignedToAndStatus(UUID assignedTo, JobStatus status, Pageable pageable);

    Page<Job> findByOrgIdAndAssignedTo(UUID orgId, UUID assignedTo, Pageable pageable);

    Page<Job> findByOrgIdAndAssignedToAndStatus(UUID orgId, UUID assignedTo, JobStatus status, Pageable pageable);

    /**
     * Used by the deadline scheduler: find all PUBLISHED jobs whose
     * applicationDeadline has already passed (i.e. it is not null and < now).
     */
    List<Job> findByStatusAndApplicationDeadlineBefore(JobStatus status, LocalDateTime deadline);
}
