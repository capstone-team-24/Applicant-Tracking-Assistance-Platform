package com.ats.jobs.repository;

import com.ats.jobs.entity.Job;
import com.ats.jobs.enums.JobStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface JobRepository extends JpaRepository<Job, UUID> {

    Page<Job> findByOrgId(UUID orgId, Pageable pageable);

    Page<Job> findByStatus(JobStatus status, Pageable pageable);

    Page<Job> findByOrgIdAndStatus(UUID orgId, JobStatus status, Pageable pageable);
}
