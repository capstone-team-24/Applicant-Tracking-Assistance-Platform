package com.ats.jobs.service;

import com.ats.jobs.entity.Job;
import com.ats.jobs.enums.JobStatus;
import com.ats.jobs.repository.JobRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Scheduler that runs every minute to enforce application deadlines.
 *
 * <p>When a recruiter sets an {@code applicationDeadline} on a job, this service
 * automatically transitions the job from {@code PUBLISHED} → {@code CLOSED} once
 * that datetime has elapsed.  Closed jobs no longer appear on the public job
 * listing or accept new applications.
 *
 * <p>The {@link com.ats.jobs.repository.JobSpec} also excludes expired jobs from
 * query results as a belt-and-suspenders measure between scheduler runs.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class DeadlineSchedulerService {

    private final JobRepository jobRepository;

    /**
     * Runs every 60 seconds.
     * Finds all PUBLISHED jobs whose {@code applicationDeadline} is not null and
     * is strictly before "now", then closes them.
     */
    @Scheduled(fixedDelay = 60_000)
    @Transactional
    public void closeExpiredJobs() {
        LocalDateTime now = LocalDateTime.now();
        List<Job> expired = jobRepository.findByStatusAndApplicationDeadlineBefore(
                JobStatus.PUBLISHED, now);

        if (expired.isEmpty()) {
            return; // nothing to do — avoid noisy logs on most ticks
        }

        log.info("Deadline scheduler: found {} expired job(s) to close.", expired.size());

        for (Job job : expired) {
            job.setStatus(JobStatus.CLOSED);
            job.setClosedAt(now);
            jobRepository.save(job);
            log.info("Auto-closed job id={} title='{}' (deadline was {})",
                    job.getId(), job.getTitle(), job.getApplicationDeadline());
        }
    }
}
