package com.ats.jobs.service;

import com.ats.jobs.config.KafkaConfig;
import com.ats.jobs.dto.RankRequestEvent;
import com.ats.jobs.dto.RankingJobResponse;
import com.ats.jobs.entity.Application;
import com.ats.jobs.entity.Job;
import com.ats.jobs.entity.RankingJob;
import com.ats.jobs.enums.RankingStatus;
import com.ats.jobs.exception.ForbiddenException;
import com.ats.jobs.exception.ResourceNotFoundException;
import com.ats.jobs.repository.ApplicationRepository;
import com.ats.jobs.repository.JobRepository;
import com.ats.jobs.repository.RankingJobRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ats.jobs.enums.ApplicationStatus;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class RankingService {

    private final RankingJobRepository rankingJobRepository;
    private final ApplicationRepository applicationRepository;
    private final JobRepository jobRepository;
    private final KafkaTemplate<String, Object> kafkaTemplate;

    @Transactional
    public RankingJobResponse triggerRanking(UUID jobId, UUID orgId) {
        // Validate job exists and belongs to org
        Job job = jobRepository.findById(jobId)
                .orElseThrow(() -> new ResourceNotFoundException("Job not found with id: " + jobId));

        if (orgId != null && !job.getOrgId().equals(orgId)) {
            throw new ForbiddenException("You do not have access to this job.");
        }

        // 1. Create RankingJob with PENDING status
        RankingJob rankingJob = RankingJob.builder()
                .jobId(jobId)
                .status(RankingStatus.PENDING)
                .build();
        RankingJob saved = rankingJobRepository.save(rankingJob);

        // 2. Get candidates that can still be ranked or re-ranked at CV review.
        // Candidates beyond SCREENED have progressed to later hiring stages.
        List<Application> rankableApplications = applicationRepository.findByJobId(jobId)
                .stream()
                .filter(a -> a.getStatus() == ApplicationStatus.APPLIED
                        || a.getStatus() == ApplicationStatus.SCREENED)
                .collect(Collectors.toList());

        if (rankableApplications.isEmpty()) {
            String message = "No rank-eligible candidates found for this job. Candidates must be APPLIED or SCREENED.";
            log.warn("{} jobId={}; ranking request not sent", message, jobId);
            saved.setStatus(RankingStatus.FAILED);
            saved.setCompletedAt(LocalDateTime.now());
            saved.setResult(Map.of("error", message));
            rankingJobRepository.save(saved);
            return mapToResponse(saved);
        }

        List<UUID> applicationIds = rankableApplications.stream()
                .map(Application::getId)
                .collect(Collectors.toList());

        List<RankRequestEvent.ApplicationPayload> applicationPayloads = rankableApplications.stream()
                .map(a -> RankRequestEvent.ApplicationPayload.builder()
                        .applicationId(a.getId())
                        .candidateAuthUserId(a.getCandidateAuthUserId())
                        .filePath(a.getOriginalFilePath())
                        .build())
                .collect(Collectors.toList());

        // 3. Emit rank request event
        RankRequestEvent event = RankRequestEvent.builder()
                .jobId(jobId)
                .rankingJobId(saved.getId())
                .applicationIds(applicationIds)
                .applications(applicationPayloads)
                .build();

        try {
            kafkaTemplate.send(
                    KafkaConfig.JOB_RANK_REQUEST_TOPIC,
                    event);
            saved.setStatus(RankingStatus.PROCESSING);
            rankingJobRepository.save(saved);
            log.info("Published job.rank.request event for jobId={}, rankingJobId={}", jobId, saved.getId());
        } catch (Exception e) {
            log.error("Failed to publish job.rank.request event: {}", e.getMessage());
            saved.setStatus(RankingStatus.FAILED);
            saved.setCompletedAt(LocalDateTime.now());
            saved.setResult(Map.of("error", "Failed to publish ranking request: " + e.getMessage()));
            rankingJobRepository.save(saved);
        }

        // 4. Return rankingJobId and status
        return mapToResponse(saved);
    }

    @Transactional(readOnly = true)
    public RankingJobResponse getRankingStatus(UUID rankingJobId) {
        RankingJob rankingJob = rankingJobRepository.findById(rankingJobId)
                .orElseThrow(() -> new ResourceNotFoundException("RankingJob not found with id: " + rankingJobId));
        return mapToResponse(rankingJob);
    }

    private RankingJobResponse mapToResponse(RankingJob rj) {
        return RankingJobResponse.builder()
                .id(rj.getId())
                .jobId(rj.getJobId())
                .status(rj.getStatus())
                .result(rj.getResult())
                .createdAt(rj.getCreatedAt())
                .completedAt(rj.getCompletedAt())
                .build();
    }
}
