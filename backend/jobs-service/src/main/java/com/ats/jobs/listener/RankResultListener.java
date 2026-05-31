package com.ats.jobs.listener;

import com.ats.jobs.config.KafkaConfig;
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
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Component
@RequiredArgsConstructor
@Slf4j
public class RankResultListener {

    private final RankingJobRepository rankingJobRepository;
    private final ApplicationRepository applicationRepository;

    @KafkaListener(topics = KafkaConfig.JOB_RANK_RESULT_TOPIC, groupId = "jobs-service")
    @Transactional
    public void handleRankResult(Map<String, Object> payload) {
        try {
            log.info("Received rank result payload: {}", payload);

            String rankingJobIdStr = (String) payload.get("rankingJobId");
            String status = (String) payload.get("status");

            if (rankingJobIdStr == null) {
                log.warn("Rank result event missing rankingJobId, skipping");
                return;
            }

            UUID rankingJobId = UUID.fromString(rankingJobIdStr);
            Optional<RankingJob> optRankingJob = rankingJobRepository.findById(rankingJobId);
            if (optRankingJob.isEmpty()) {
                log.warn("RankingJob not found: {}", rankingJobId);
                return;
            }

            RankingJob rankingJob = optRankingJob.get();

            if ("COMPLETED".equalsIgnoreCase(status)) {
                rankingJob.setStatus(RankingStatus.COMPLETED);

                Map<String, Object> resultMap = new HashMap<>();
                resultMap.put("rankings", payload.get("rankings"));
                if (payload.get("metadata") != null) {
                    resultMap.put("metadata", payload.get("metadata"));
                }
                rankingJob.setResult(resultMap);
            } else {
                rankingJob.setStatus(RankingStatus.FAILED);
                Map<String, Object> resultMap = new HashMap<>();
                resultMap.put("error", "Ranking failed");
                if (payload.get("metadata") != null) {
                    resultMap.put("metadata", payload.get("metadata"));
                }
                rankingJob.setResult(resultMap);
            }

            rankingJob.setCompletedAt(LocalDateTime.now());
            rankingJobRepository.save(rankingJob);

            // Update individual application scores and positions
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> rankings = (List<Map<String, Object>>) payload.get("rankings");
            if (rankings != null) {
                for (Map<String, Object> ranked : rankings) {
                    String appIdStr = (String) ranked.get("applicationId");
                    if (appIdStr == null) continue;

                    UUID applicationId = UUID.fromString(appIdStr);
                    Optional<Application> optApp = applicationRepository.findById(applicationId);
                    if (optApp.isPresent()) {
                        Application app = optApp.get();

                        Number compositeScore = (Number) ranked.get("compositeScore");
                        Number rankingPosition = (Number) ranked.get("rankingPosition");
                        if (compositeScore != null) app.setCompositeScore(compositeScore.doubleValue());
                        if (rankingPosition != null) app.setRankingPosition(rankingPosition.intValue());

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

            log.info("Rank result processed for rankingJobId={}", rankingJobId);

        } catch (Exception e) {
            log.error("Error processing rank result event: {}", e.getMessage(), e);
        }
    }
}
