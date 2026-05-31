package com.ats.jobs.listener;

import com.ats.jobs.config.KafkaConfig;
import com.ats.jobs.dto.NotificationSendRequest;
import com.ats.jobs.entity.Application;
import com.ats.jobs.entity.Job;
import com.ats.jobs.enums.ApplicationStatus;
import com.ats.jobs.feign.NotificationServiceClient;
import com.ats.jobs.repository.ApplicationRepository;
import com.ats.jobs.repository.JobRepository;
import com.ats.jobs.util.EmailTemplate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Listens for "assessment.completed" events from the assessment-service.
 * When a candidate finishes and scores their OA, this listener finds their
 * application for the relevant job and advances the status to OA_COMPLETED.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class AssessmentCompletedListener {

    private final ApplicationRepository applicationRepository;
    private final JobRepository jobRepository;
    private final NotificationServiceClient notificationServiceClient;

    @KafkaListener(topics = KafkaConfig.ASSESSMENT_EVENTS_TOPIC, groupId = "jobs-service-assessment")
    @Transactional
    public void handleAssessmentCompleted(Map<String, Object> payload) {
        try {
            log.info("Received assessment event payload: {}", payload);

            String status = (String) payload.get("status");
            if (!"SCORED".equalsIgnoreCase(status)) {
                log.debug("Ignoring assessment event with status={}", status);
                return;
            }

            String candidateIdStr = (String) payload.get("candidateId");
            String jobIdStr = (String) payload.get("jobId");

            if (candidateIdStr == null || jobIdStr == null) {
                log.warn("Assessment completed event missing candidateId or jobId, skipping");
                return;
            }

            UUID candidateId = UUID.fromString(candidateIdStr);
            UUID jobId = UUID.fromString(jobIdStr);

            List<Application> apps = applicationRepository
                    .findByJobIdAndCandidateAuthUserId(jobId, candidateId);

            if (apps.isEmpty()) {
                log.warn("No application found for candidateId={} jobId={}", candidateId, jobId);
                return;
            }

            Application app = apps.get(0);

            // Only advance if the candidate is in a state that makes sense
            if (app.getStatus() == ApplicationStatus.OA_INVITED ||
                app.getStatus() == ApplicationStatus.SCREENED) {
                
                if (payload.containsKey("score")) {
                    Object scoreObj = payload.get("score");
                    if (scoreObj instanceof Number) {
                        app.setOaScore(((Number) scoreObj).doubleValue());
                    } else if (scoreObj instanceof String) {
                        try {
                            app.setOaScore(Double.parseDouble((String) scoreObj));
                        } catch (NumberFormatException ignored) {}
                    }
                }

                app.setStatus(ApplicationStatus.OA_COMPLETED);
                applicationRepository.save(app);
                log.info("Marked application {} as OA_COMPLETED with score {} for candidate {} on job {}",
                        app.getId(), app.getOaScore(), candidateId, jobId);

                // Send OA completion email
                try {
                    String email = app.getCandidateEmail();
                    String candidateName = app.getCandidateName() != null ? app.getCandidateName() : "Candidate";
                    Job job = jobRepository.findById(jobId).orElse(null);
                    String jobTitle = job != null ? job.getTitle() : "the position";

                    if (email != null && !email.isBlank()) {
                        String subject = "Your Online Assessment Has Been Received — " + jobTitle;
                        String body = buildOaCompletionEmail(candidateName, jobTitle);
                        notificationServiceClient.sendNotification(NotificationSendRequest.builder()
                                .recipientEmail(email)
                                .recipientUserId(candidateId)
                                .subject(subject)
                                .body(body)
                                .type("OA_COMPLETED")
                                .build());
                        log.info("Sent OA completion email to {}", email);
                    }
                } catch (Exception e) {
                    log.error("Failed to send OA completion email: {}", e.getMessage());
                }
            } else {
                log.info("Application {} already in status {}; not overwriting with OA_COMPLETED",
                        app.getId(), app.getStatus());
            }

        } catch (Exception e) {
            log.error("Error processing assessment.completed event: {}", e.getMessage(), e);
        }
    }

    private String buildOaCompletionEmail(String candidateName, String jobTitle) {
        String content = EmailTemplate.paragraph("Dear <strong>" + EmailTemplate.escape(candidateName) + "</strong>,")
                + EmailTemplate.paragraph("Thank you for completing the online assessment for the <strong>" + EmailTemplate.escape(jobTitle) + "</strong> position.")
                + EmailTemplate.paragraph("Your submission has been successfully received. Our team will review your results and will be in touch with you regarding the next steps.")
                + EmailTemplate.paragraph("We appreciate your time and effort, and we look forward to considering your application.")
                + EmailTemplate.paragraph("Best regards,<br/><strong>The Recruitment Team</strong>");
        return EmailTemplate.render("Online Assessment Received", content);
    }
}
