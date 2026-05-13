package com.ats.jobs.listener;

import com.ats.jobs.config.KafkaConfig;
import com.ats.jobs.dto.RankResultEvent;
import com.ats.jobs.entity.Application;
import com.ats.jobs.entity.RankingJob;
import com.ats.jobs.enums.ApplicationStatus;
import com.ats.jobs.enums.RankingStatus;
import com.ats.jobs.repository.ApplicationRepository;
import com.ats.jobs.repository.RankingJobRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

@Component
@RequiredArgsConstructor
@Slf4j
public class RankResultListener {

    private final RankingJobRepository rankingJobRepository;
    private final ApplicationRepository applicationRepository;

    @KafkaListener(topics = KafkaConfig.JOB_RANK_RESULT_TOPIC, groupId = "jobs-service")
    @Transactional
    public void handleRankResult(RankResultEvent event) {
        log.info("Received rank result for rankingJobId={}, jobId={}", event.getRankingJobId(), event.getJobId());

        Optional<RankingJob> optRankingJob = rankingJobRepository.findById(event.getRankingJobId());
        if (optRankingJob.isEmpty()) {
            log.warn("RankingJob not found: {}", event.getRankingJobId());
            return;
        }

        RankingJob rankingJob = optRankingJob.get();

        if ("COMPLETED".equalsIgnoreCase(event.getStatus())) {
            rankingJob.setStatus(RankingStatus.COMPLETED);

            Map<String, Object> resultMap = new HashMap<>();
            resultMap.put("rankings", event.getRankings());
            if (event.getMetadata() != null) {
                resultMap.put("metadata", event.getMetadata());
            }
            rankingJob.setResult(resultMap);
        } else {
            rankingJob.setStatus(RankingStatus.FAILED);
            Map<String, Object> resultMap = new HashMap<>();
            resultMap.put("error", "Ranking failed");
            if (event.getMetadata() != null) {
                resultMap.put("metadata", event.getMetadata());
            }
            rankingJob.setResult(resultMap);
        }

        rankingJob.setCompletedAt(LocalDateTime.now());
        rankingJobRepository.save(rankingJob);

        // Update individual application scores and positions
        if (event.getRankings() != null) {
            for (RankResultEvent.RankedApplication ranked : event.getRankings()) {
                Optional<Application> optApp = applicationRepository.findById(ranked.getApplicationId());
                if (optApp.isPresent()) {
                    Application app = optApp.get();
                    app.setCompositeScore(ranked.getCompositeScore());
                    app.setRankingPosition(ranked.getRankingPosition());
                    // Only advance to SCREENED if the candidate is still at APPLIED.
                    // Do NOT overwrite statuses that have already progressed further
                    // (e.g. OA_INVITED, OA_COMPLETED, INTERVIEW_INVITED, etc.).
                    if (app.getStatus() == ApplicationStatus.APPLIED) {
                        app.setStatus(ApplicationStatus.SCREENED);
                    } else {
                        log.info("Skipping status update for application {} — current status={} is beyond APPLIED",
                                app.getId(), app.getStatus());
                    }
                    applicationRepository.save(app);
                }
            }
        }

        log.info("Rank result processed for rankingJobId={}", event.getRankingJobId());
    }
}
