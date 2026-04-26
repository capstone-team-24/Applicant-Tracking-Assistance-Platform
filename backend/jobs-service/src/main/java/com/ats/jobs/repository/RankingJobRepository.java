package com.ats.jobs.repository;

import com.ats.jobs.entity.RankingJob;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface RankingJobRepository extends JpaRepository<RankingJob, UUID> {

    List<RankingJob> findByJobId(UUID jobId);
}
