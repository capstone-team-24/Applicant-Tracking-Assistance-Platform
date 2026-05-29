package com.ats.jobs.service;

import com.ats.jobs.dto.NotificationSendRequest;
import com.ats.jobs.dto.SendInterviewInviteRequest;
import com.ats.jobs.dto.SendInterviewInviteResponse;
import com.ats.jobs.dto.RejectResponse;
import com.ats.jobs.entity.Application;
import com.ats.jobs.entity.InterviewInvite;
import com.ats.jobs.entity.Job;
import com.ats.jobs.enums.ApplicationStatus;
import com.ats.jobs.exception.ForbiddenException;
import com.ats.jobs.exception.ResourceNotFoundException;
import com.ats.jobs.feign.NotificationServiceClient;
import com.ats.jobs.feign.OrgServiceClient;
import com.ats.jobs.repository.ApplicationRepository;
import com.ats.jobs.repository.InterviewInviteRepository;
import com.ats.jobs.repository.JobRepository;
import com.ats.jobs.util.EmailTemplate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.*;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
@Slf4j
public class InterviewInviteService {

    private final ApplicationRepository applicationRepository;
    private final JobRepository jobRepository;
    private final InterviewInviteRepository interviewInviteRepository;
    private final com.ats.jobs.repository.AssessmentInviteRepository assessmentInviteRepository;
    private final NotificationServiceClient notificationServiceClient;
    private final RestTemplate restTemplate;
    private final OrgServiceClient orgServiceClient;

    @Value("${app.frontend-url:http://localhost:3000}")
    private String frontendUrl;

    @Value("${ASSESSMENT_SERVICE_URL:http://assessment-service:8091}")
    private String assessmentServiceUrl;

    /**
     * Send interview booking invites to the top-N OA scorers for a job.
     *
     * Flow:
     * 1. Fetch scored submissions from assessment-service.
     * 2. Sort by score descending, take top-N (respecting optional minScore).
     * 3. For each: find the application, update status → INTERVIEW_INVITED, send email, persist invite.
     */
    public SendInterviewInviteResponse sendInterviewInvites(
            UUID jobId, SendInterviewInviteRequest request, UUID orgId) {

        Job job = jobRepository.findById(jobId)
                .orElseThrow(() -> new ResourceNotFoundException("Job not found: " + jobId));

        if (orgId != null && !job.getOrgId().equals(orgId)) {
            throw new ForbiddenException("You do not have access to this job.");
        }

        int topN = (request.getTopN() != null && request.getTopN() > 0) ? request.getTopN() : 10;
        double minScore = (request.getMinScore() != null) ? request.getMinScore() : 0.0;

        // Fetch scored submissions from assessment-service
        List<Map<String, Object>> submissions = fetchScoredSubmissions(request.getAssessmentId());
        if (submissions == null || submissions.isEmpty()) {
            log.warn("No scored submissions found for assessmentId={}", request.getAssessmentId());
            return SendInterviewInviteResponse.builder()
                    .sent(0).skipped(0)
                    .sentTo(List.of())
                    .skippedReasons(List.of("No scored submissions found for this assessment."))
                    .build();
        }

        // Sort by score descending, filter by minScore, cap at topN
        List<Map<String, Object>> topCandidates = submissions.stream()
                .filter(s -> {
                    Object scoreObj = s.get("score");
                    if (scoreObj == null) return false;
                    double score = ((Number) scoreObj).doubleValue();
                    return score >= minScore;
                })
                .sorted(Comparator.comparingDouble(
                        s -> -((Number) ((Map<?, ?>) s).get("score")).doubleValue()))
                .limit(topN)
                .toList();

        List<String> sentTo = new ArrayList<>();
        List<String> skippedReasons = new ArrayList<>();

        for (Map<String, Object> submission : topCandidates) {
            String candidateIdStr = (String) submission.get("candidateId");
            if (candidateIdStr == null) {
                skippedReasons.add("Submission missing candidateId");
                continue;
            }

            UUID candidateId;
            try {
                candidateId = UUID.fromString(candidateIdStr);
            } catch (IllegalArgumentException e) {
                skippedReasons.add("Invalid candidateId: " + candidateIdStr);
                continue;
            }

            double score = ((Number) submission.get("score")).doubleValue();

            // Find the application
            List<Application> apps = applicationRepository
                    .findByJobIdAndCandidateAuthUserId(jobId, candidateId);
            if (apps.isEmpty()) {
                skippedReasons.add("No application found for candidateId=" + candidateId);
                log.warn("No application for candidateId={} jobId={}", candidateId, jobId);
                continue;
            }
            Application app = apps.get(0);

            // Skip if already rejected or withdrawn
            if (app.getStatus() == ApplicationStatus.REJECTED || app.getStatus() == ApplicationStatus.WITHDRAWN) {
                skippedReasons.add("Application " + app.getId() + " is already " + app.getStatus());
                continue;
            }

            String email = app.getCandidateEmail();

            if (email == null || email.isBlank()) {
                skippedReasons.add("Application " + app.getId() + " has no email");
                continue;
            }

            // Skip if already invited
            if (interviewInviteRepository.existsByJobIdAndCandidateAuthUserId(jobId, candidateId)) {
                skippedReasons.add(email + " already has an interview invite for this job");
                log.info("Skipping duplicate interview invite for candidateId={} jobId={}", candidateId, jobId);
                continue;
            }

            String candidateName = app.getCandidateName() != null ? app.getCandidateName() : "Candidate";
            String schedulingUrl = frontendUrl + "/interview/schedule/" + jobId;

            // Send email
            try {
                String subject = "Interview Invitation — " + job.getTitle();
            String body = buildEmailHtml(candidateName, job.getTitle(), schedulingUrl);
                notificationServiceClient.sendNotification(NotificationSendRequest.builder()
                        .recipientEmail(email)
                        .recipientUserId(candidateId)
                        .subject(subject)
                        .body(body)
                        .type("INTERVIEW_INVITE")
                        .build());

                // Update application status
                app.setStatus(ApplicationStatus.INTERVIEW_INVITED);
                applicationRepository.save(app);

                // Persist invite for candidate dashboard
                String orgName = null;
                try { orgName = orgServiceClient.getOrganizationName(job.getOrgId()); } catch (Exception ignored) {}
                interviewInviteRepository.save(InterviewInvite.builder()
                        .jobId(jobId)
                        .applicationId(app.getId())
                        .candidateAuthUserId(candidateId)
                        .candidateEmail(email)
                        .jobTitle(job.getTitle())
                        .organizationName(orgName)
                        .oaScore(score)
                        .schedulingUrl(schedulingUrl)
                        .expiresAt(request.getExpiresAt())
                        .build());

                sentTo.add(email);
                log.info("Interview invite sent to {} (score={}) for job {}", email, score, jobId);

            } catch (Exception e) {
                skippedReasons.add("Failed to send to " + email + ": " + e.getMessage());
                log.error("Failed to send interview invite to {} for job {}: {}", email, jobId, e.getMessage());
            }
        }

        return SendInterviewInviteResponse.builder()
                .sent(sentTo.size())
                .skipped(skippedReasons.size())
                .sentTo(sentTo)
                .skippedReasons(skippedReasons)
                .build();
    }

    /**
     * Send an interview invite to a single specific application.
     *
     * <p>Unlike {@link #sendInterviewInvites}, this bypasses the OA assessment
     * score filter and topN cap. The recruiter is explicitly choosing this
     * candidate regardless of AI ranking.
     *
     * @param applicationId the application to invite
     * @param request       optional deadline; no other fields required
     * @param orgId         recruiter's org for authorization
     */
    public SendInterviewInviteResponse sendInterviewInviteToApplication(
            UUID applicationId,
            com.ats.jobs.dto.SendSingleInterviewInviteRequest request,
            UUID orgId) {

        Application app = applicationRepository.findById(applicationId)
                .orElseThrow(() -> new com.ats.jobs.exception.ResourceNotFoundException("Application not found: " + applicationId));

        Job job = jobRepository.findById(app.getJobId())
                .orElseThrow(() -> new com.ats.jobs.exception.ResourceNotFoundException("Job not found: " + app.getJobId()));

        if (orgId != null && !job.getOrgId().equals(orgId)) {
            throw new com.ats.jobs.exception.ForbiddenException("You do not have access to this job.");
        }

        if (app.getStatus() == ApplicationStatus.REJECTED || app.getStatus() == ApplicationStatus.WITHDRAWN) {
            return SendInterviewInviteResponse.builder()
                    .sent(0).skipped(1)
                    .sentTo(List.of())
                    .skippedReasons(List.of("Application is " + app.getStatus() + " and cannot be invited."))
                    .build();
        }

        String email = app.getCandidateEmail();
        if (email == null || email.isBlank()) {
            return SendInterviewInviteResponse.builder()
                    .sent(0).skipped(1)
                    .sentTo(List.of())
                    .skippedReasons(List.of("No email address on file for application " + applicationId))
                    .build();
        }

        // Attempt to pull actual OA score from assessment-service; fall back to 0.0
        double oaScore = 0.0;
        if (app.getCandidateAuthUserId() != null) {
            try {
                // Fetch any scored submissions and pick the latest score
                List<Map<String, Object>> subs = fetchScoredSubmissions(null);
                // (null assessmentId → returns empty list; real lookup requires assessmentId which we don't have here)
            } catch (Exception ignored) { }
        }

        String candidateName = app.getCandidateName() != null ? app.getCandidateName() : "Candidate";
        String schedulingUrl = frontendUrl + "/interview/schedule/" + app.getJobId();

        try {
            String subject = "Interview Invitation — " + job.getTitle();
            String body = buildEmailHtml(candidateName, job.getTitle(), schedulingUrl);
            notificationServiceClient.sendNotification(NotificationSendRequest.builder()
                    .recipientEmail(email)
                    .recipientUserId(app.getCandidateAuthUserId())
                    .subject(subject)
                    .body(body)
                    .type("INTERVIEW_INVITE")
                    .build());

            app.setStatus(ApplicationStatus.INTERVIEW_INVITED);
            applicationRepository.save(app);

            // Upsert interview invite record for candidate dashboard
            if (app.getCandidateAuthUserId() != null) {
                List<InterviewInvite> existing = interviewInviteRepository
                        .findByJobIdAndCandidateAuthUserId(app.getJobId(), app.getCandidateAuthUserId());
                if (!existing.isEmpty()) {
                    InterviewInvite inv = existing.get(0);
                    inv.setSchedulingUrl(schedulingUrl);
                    inv.setExpiresAt(request != null ? request.getExpiresAt() : null);
                    interviewInviteRepository.save(inv);
                } else {
                    String orgName = null;
                    try { orgName = orgServiceClient.getOrganizationName(job.getOrgId()); } catch (Exception ignored) {}
                    interviewInviteRepository.save(InterviewInvite.builder()
                            .jobId(app.getJobId())
                            .applicationId(app.getId())
                            .candidateAuthUserId(app.getCandidateAuthUserId())
                            .candidateEmail(email)
                            .jobTitle(job.getTitle())
                            .organizationName(orgName)
                            .oaScore(oaScore)
                            .schedulingUrl(schedulingUrl)
                            .expiresAt(request != null ? request.getExpiresAt() : null)
                            .build());
                }
            }

            log.info("Manual interview invite sent to {} (application {}) for job {}", email, applicationId, app.getJobId());

            return SendInterviewInviteResponse.builder()
                    .sent(1).skipped(0)
                    .sentTo(List.of(email))
                    .skippedReasons(List.of())
                    .build();

        } catch (Exception e) {
            log.error("Failed to send manual interview invite to {} for application {}: {}", email, applicationId, e.getMessage());
            return SendInterviewInviteResponse.builder()
                    .sent(0).skipped(1)
                    .sentTo(List.of())
                    .skippedReasons(List.of("Failed to deliver to " + email + ": " + e.getMessage()))
                    .build();
        }
    }

    /**
     * Reject all candidates for a job who made it to the OA stage but have not received an interview invite.
     */
    public RejectResponse rejectUninvitedCandidates(UUID jobId, UUID orgId) {
        Job job = jobRepository.findById(jobId)
                .orElseThrow(() -> new ResourceNotFoundException("Job not found: " + jobId));

        if (orgId != null && !job.getOrgId().equals(orgId)) {
            throw new ForbiddenException("You do not have access to this job.");
        }

        List<Application> allApps = applicationRepository.findByJobId(jobId);
        List<String> sentTo = new ArrayList<>();

        for (Application app : allApps) {
            // Skip already rejected or withdrawn
            if (app.getStatus() == ApplicationStatus.REJECTED || app.getStatus() == ApplicationStatus.WITHDRAWN) {
                continue;
            }

            // ONLY target candidates who WERE sent an OA
            if (app.getCandidateAuthUserId() == null || 
                !assessmentInviteRepository.existsByJobIdAndCandidateAuthUserId(jobId, app.getCandidateAuthUserId())) {
                continue;
            }

            // Skip if candidate ALREADY has an interview invite
            if (interviewInviteRepository.existsByJobIdAndCandidateAuthUserId(jobId, app.getCandidateAuthUserId())) {
                continue;
            }

            // Set to REJECTED
            app.setStatus(ApplicationStatus.REJECTED);
            applicationRepository.save(app);

            // Send rejection email
            String email = app.getCandidateEmail();
            if (email != null && !email.isBlank()) {
                String candidateName = app.getCandidateName() != null ? app.getCandidateName() : "Candidate";
                String subject = "Update on your application for " + job.getTitle();
                String body = buildRejectionEmailHtml(candidateName, job.getTitle());
                
                try {
                    notificationServiceClient.sendNotification(NotificationSendRequest.builder()
                            .recipientEmail(email)
                            .recipientUserId(app.getCandidateAuthUserId())
                            .subject(subject)
                            .body(body)
                            .type("REJECTION")
                            .build());
                    sentTo.add(email);
                } catch (Exception e) {
                    log.error("Failed to send post-OA rejection email to {}: {}", email, e.getMessage());
                }
            }
        }

        log.info("Rejected {} uninvited candidates for job {}.", sentTo.size(), jobId);
        return RejectResponse.builder()
                .rejectedCount(sentTo.size())
                .sentTo(sentTo)
                .build();
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> fetchScoredSubmissions(String assessmentId) {
        try {
            String url = assessmentServiceUrl + "/assessments/" + assessmentId + "/submissions/scored";
            ResponseEntity<List<Map<String, Object>>> resp = restTemplate.exchange(
                    url, HttpMethod.GET, null,
                    new ParameterizedTypeReference<>() {});
            return resp.getBody();
        } catch (Exception e) {
            log.error("Failed to fetch scored submissions for assessmentId={}: {}", assessmentId, e.getMessage());
            return List.of();
        }
    }

    private String buildEmailHtml(String candidateName, String jobTitle, String schedulingUrl) {
        String content = EmailTemplate.paragraph("Dear <strong>" + EmailTemplate.escape(candidateName) + "</strong>,")
                + EmailTemplate.paragraph("Congratulations. You performed well on the online assessment for <strong>" + EmailTemplate.escape(jobTitle) + "</strong>, and we would like to invite you to the next stage: a formal interview.")
                + EmailTemplate.button(schedulingUrl, "Book Interview")
                + EmailTemplate.fallbackLink(schedulingUrl);
        return EmailTemplate.render("Interview Invitation", content, "Please do not reply to this email.");
    }

    /**
     * Update the deadline for all interview invites for a given job.
     */
    public void updateDeadlineForJob(UUID jobId, LocalDateTime newDeadline) {
        List<InterviewInvite> invites = interviewInviteRepository.findByJobId(jobId);
        for (InterviewInvite invite : invites) {
            invite.setExpiresAt(newDeadline);
        }
        interviewInviteRepository.saveAll(invites);
        log.info("Updated deadline for {} interview invites for job {}", invites.size(), jobId);
    }

    private String buildRejectionEmailHtml(String candidateName, String jobTitle) {
        String content = EmailTemplate.paragraph("Dear <strong>" + EmailTemplate.escape(candidateName) + "</strong>,")
                + EmailTemplate.paragraph("Thank you for taking the time to complete the online assessment for the <strong>" + EmailTemplate.escape(jobTitle) + "</strong> role. We appreciate the effort you put into the assessment and your continued interest in our team.")
                + EmailTemplate.paragraph("After careful consideration of the assessment results and profiles of all candidates, we regret to inform you that we will not be moving forward with your application to the interview stage at this time. We had many highly qualified applicants and have decided to proceed with candidates whose scores and experiences more closely match the current needs of the role.")
                + EmailTemplate.paragraph("We wish you all the best in your job search and your future professional endeavors.");
        return EmailTemplate.render("Application Update", content, "Please do not reply to this email.");
    }
}
