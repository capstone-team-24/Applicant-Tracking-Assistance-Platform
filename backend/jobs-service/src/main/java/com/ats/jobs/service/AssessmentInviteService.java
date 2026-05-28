package com.ats.jobs.service;

import com.ats.jobs.dto.NotificationSendRequest;
import com.ats.jobs.entity.AssessmentInvite;
import com.ats.jobs.dto.SendAssessmentRequest;
import com.ats.jobs.dto.SendAssessmentResponse;
import com.ats.jobs.dto.RejectResponse;
import com.ats.jobs.entity.Application;
import com.ats.jobs.entity.Job;
import com.ats.jobs.enums.ApplicationStatus;
import com.ats.jobs.exception.ForbiddenException;
import com.ats.jobs.exception.ResourceNotFoundException;
import com.ats.jobs.feign.NotificationServiceClient;
import com.ats.jobs.feign.OrgServiceClient;
import com.ats.jobs.repository.ApplicationRepository;
import com.ats.jobs.repository.AssessmentInviteRepository;
import com.ats.jobs.repository.JobRepository;
import com.ats.jobs.util.EmailTemplate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
@Slf4j
public class AssessmentInviteService {

    private final ApplicationRepository applicationRepository;
    private final JobRepository jobRepository;
    private final NotificationServiceClient notificationServiceClient;
    private final AssessmentInviteRepository assessmentInviteRepository;
    private final OrgServiceClient orgServiceClient;

    @Value("${app.frontend-url:http://localhost:3000}")
    private String frontendUrl;

    /**
     * Send assessment invites to the top-N ranked candidates for a given job.
     *
     * <p>If candidates have been ranked (rankingPosition IS NOT NULL), they are
     * selected in ascending rank order. Otherwise, all applications are used as
     * a fallback, ordered by creation date.
     *
     * @param jobId   the job whose candidates to invite
     * @param request contains the assessment token, title, time limit, and topN
     * @param orgId   the recruiter's org — used to authorise access to the job
     * @return a summary of how many invites were sent and how many were skipped
     */
    public SendAssessmentResponse sendAssessmentToTopCandidates(
            UUID jobId,
            SendAssessmentRequest request,
            UUID orgId) {

        Job job = jobRepository.findById(jobId)
                .orElseThrow(() -> new ResourceNotFoundException("Job not found: " + jobId));

        if (orgId != null && !job.getOrgId().equals(orgId)) {
            throw new ForbiddenException("You do not have access to this job.");
        }

        int topN = (request.getTopN() != null && request.getTopN() > 0) ? request.getTopN() : 10;

        // Prefer ranked applications (post AI-ranking); fall back to insertion order.
        List<Application> rankedCandidates =
                applicationRepository.findRankedByJobId(jobId, PageRequest.of(0, 1000));

        List<Application> candidates = new ArrayList<>();

        if (rankedCandidates.isEmpty()) {
            log.info("No ranked applications found for job {}; falling back to all applications.", jobId);
            List<Application> allApps = applicationRepository.findByJobId(jobId);
            for (Application app : allApps) {
                if (candidates.size() >= topN) break;
                if (app.getStatus() == ApplicationStatus.REJECTED || app.getStatus() == ApplicationStatus.WITHDRAWN) {
                    continue;
                }
                if (app.getCandidateAuthUserId() != null && 
                    assessmentInviteRepository.existsByJobIdAndCandidateAuthUserId(jobId, app.getCandidateAuthUserId())) {
                    continue;
                }
                candidates.add(app);
            }
        } else {
            for (Application app : rankedCandidates) {
                if (candidates.size() >= topN) break;
                if (app.getStatus() == ApplicationStatus.REJECTED || app.getStatus() == ApplicationStatus.WITHDRAWN) {
                    continue;
                }
                if (app.getCandidateAuthUserId() != null && 
                    assessmentInviteRepository.existsByJobIdAndCandidateAuthUserId(jobId, app.getCandidateAuthUserId())) {
                    continue;
                }
                candidates.add(app);
            }
        }

        log.info("Sending OA invites for job {} to {} candidate(s).", jobId, candidates.size());

        List<String> sentTo = new ArrayList<>();
        List<String> skippedReasons = new ArrayList<>();

        for (Application app : candidates) {
            String email = app.getCandidateEmail();

            if (email == null || email.isBlank()) {
                String reason = String.format(
                        "Application %s (rank %s) — no email address on file",
                        app.getId(),
                        app.getRankingPosition() != null ? app.getRankingPosition() : "unranked");
                skippedReasons.add(reason);
                log.warn("Skipping application {}: no email.", app.getId());
                continue;
            }

            String candidateName = app.getCandidateName() != null ? app.getCandidateName() : "Candidate";
            String assessmentLink = buildAssessmentLink(request.getAssessmentToken(), app.getCandidateAuthUserId());
            String subject = "Invitation to Complete Online Assessment — " + job.getTitle();
            String body = buildEmailHtml(
                    candidateName,
                    job.getTitle(),
                    request.getAssessmentTitle(),
                    request.getTimeLimitMinutes(),
                    assessmentLink);

            try {
                notificationServiceClient.sendNotification(NotificationSendRequest.builder()
                        .recipientEmail(email)
                        .subject(subject)
                        .body(body)
                        .type("OA_INVITE")
                        .build());
                sentTo.add(email);
                log.info("OA invite sent to {} (application {}, rank {}) for job {}.",
                        email, app.getId(), app.getRankingPosition(), jobId);

                if (app.getCandidateAuthUserId() != null) {
                    try {
                        String orgName = null;
                        try { orgName = orgServiceClient.getOrganizationName(job.getOrgId()); } catch (Exception ignored) {}
                        assessmentInviteRepository.save(AssessmentInvite.builder()
                                .jobId(jobId)
                                .applicationId(app.getId())
                                .candidateAuthUserId(app.getCandidateAuthUserId())
                                .candidateEmail(email)
                                .jobTitle(job.getTitle())
                                .organizationName(orgName)
                                .assessmentToken(request.getAssessmentToken())
                                .assessmentTitle(request.getAssessmentTitle())
                                .timeLimitMinutes(request.getTimeLimitMinutes())
                                .expiresAt(request.getExpiresAt())
                                .build());
                                
                        app.setStatus(ApplicationStatus.OA_INVITED);
                        applicationRepository.save(app);
                    } catch (Exception persistEx) {
                        log.error("OA invite email sent to {} but failed to persist invite for dashboard: {}",
                                email, persistEx.getMessage());
                    }
                } else {
                    log.warn("OA invite email sent to {} but no candidateAuthUserId on application {}; not persisted for dashboard.",
                            email, app.getId());
                }
            } catch (Exception e) {
                String reason = "Failed to deliver to " + email + ": " + e.getMessage();
                skippedReasons.add(reason);
                log.error("Failed to send OA invite to {} for job {}: {}", email, jobId, e.getMessage());
            }
        }

        log.info("OA invite run complete for job {}: sent={}, skipped={}.",
                jobId, sentTo.size(), skippedReasons.size());

        return SendAssessmentResponse.builder()
                .sent(sentTo.size())
                .skipped(skippedReasons.size())
                .sentTo(sentTo)
                .skippedReasons(skippedReasons)
                .build();
    }

    /**
     * Send an OA invite to a single specific application.
     *
     * <p>Unlike {@link #sendAssessmentToTopCandidates}, this method is recruiter-
     * initiated and bypasses the AI ranking / "already invited" guard. If the
     * candidate was previously invited the record is updated and a fresh email
     * is sent — the recruiter explicitly chose this person.
     *
     * @param applicationId the application to invite
     * @param request       assessment token, title, time limit, optional deadline
     * @param orgId         recruiter's org — used to authorise access to the job
     */
    public SendAssessmentResponse sendAssessmentToApplication(
            UUID applicationId,
            SendAssessmentRequest request,
            UUID orgId) {

        Application app = applicationRepository.findById(applicationId)
                .orElseThrow(() -> new ResourceNotFoundException("Application not found: " + applicationId));

        Job job = jobRepository.findById(app.getJobId())
                .orElseThrow(() -> new ResourceNotFoundException("Job not found: " + app.getJobId()));

        if (orgId != null && !job.getOrgId().equals(orgId)) {
            throw new ForbiddenException("You do not have access to this job.");
        }

        if (app.getStatus() == ApplicationStatus.REJECTED || app.getStatus() == ApplicationStatus.WITHDRAWN) {
            return SendAssessmentResponse.builder()
                    .sent(0).skipped(1)
                    .sentTo(List.of())
                    .skippedReasons(List.of("Application is " + app.getStatus() + " and cannot be invited."))
                    .build();
        }

        String email = app.getCandidateEmail();
        if (email == null || email.isBlank()) {
            return SendAssessmentResponse.builder()
                    .sent(0).skipped(1)
                    .sentTo(List.of())
                    .skippedReasons(List.of("No email address on file for application " + applicationId))
                    .build();
        }

        String candidateName = app.getCandidateName() != null ? app.getCandidateName() : "Candidate";
        String assessmentLink = buildAssessmentLink(request.getAssessmentToken(), app.getCandidateAuthUserId());
        String subject = "Invitation to Complete Online Assessment — " + job.getTitle();
        String body = buildEmailHtml(
                candidateName,
                job.getTitle(),
                request.getAssessmentTitle(),
                request.getTimeLimitMinutes(),
                assessmentLink);

        try {
            notificationServiceClient.sendNotification(NotificationSendRequest.builder()
                    .recipientEmail(email)
                    .subject(subject)
                    .body(body)
                    .type("OA_INVITE")
                    .build());
            log.info("Manual OA invite sent to {} (application {}) for job {}.", email, applicationId, app.getJobId());

            if (app.getCandidateAuthUserId() != null) {
                // Upsert: update existing invite or create a new one
                List<AssessmentInvite> existing = assessmentInviteRepository
                        .findByJobIdAndCandidateAuthUserId(app.getJobId(), app.getCandidateAuthUserId());
                if (!existing.isEmpty()) {
                    AssessmentInvite inv = existing.get(0);
                    inv.setAssessmentToken(request.getAssessmentToken());
                    inv.setAssessmentTitle(request.getAssessmentTitle());
                    inv.setTimeLimitMinutes(request.getTimeLimitMinutes());
                    inv.setExpiresAt(request.getExpiresAt());
                    assessmentInviteRepository.save(inv);
                } else {
                    String orgName = null;
                    try { orgName = orgServiceClient.getOrganizationName(job.getOrgId()); } catch (Exception ignored) {}
                    assessmentInviteRepository.save(AssessmentInvite.builder()
                            .jobId(app.getJobId())
                            .applicationId(app.getId())
                            .candidateAuthUserId(app.getCandidateAuthUserId())
                            .candidateEmail(email)
                            .jobTitle(job.getTitle())
                            .organizationName(orgName)
                            .assessmentToken(request.getAssessmentToken())
                            .assessmentTitle(request.getAssessmentTitle())
                            .timeLimitMinutes(request.getTimeLimitMinutes())
                            .expiresAt(request.getExpiresAt())
                            .build());
                }
            }

            app.setStatus(ApplicationStatus.OA_INVITED);
            applicationRepository.save(app);

            return SendAssessmentResponse.builder()
                    .sent(1).skipped(0)
                    .sentTo(List.of(email))
                    .skippedReasons(List.of())
                    .build();

        } catch (Exception e) {
            log.error("Failed to send manual OA invite to {} for application {}: {}", email, applicationId, e.getMessage());
            return SendAssessmentResponse.builder()
                    .sent(0).skipped(1)
                    .sentTo(List.of())
                    .skippedReasons(List.of("Failed to deliver to " + email + ": " + e.getMessage()))
                    .build();
        }
    }

    /**
     * Reject all candidates for a job who have not received an assessment invite
     * and are not already rejected or withdrawn.
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

            // Skip if candidate already has an invite
            if (app.getCandidateAuthUserId() != null && 
                assessmentInviteRepository.existsByJobIdAndCandidateAuthUserId(jobId, app.getCandidateAuthUserId())) {
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
                            .subject(subject)
                            .body(body)
                            .type("REJECTION")
                            .build());
                    sentTo.add(email);
                } catch (Exception e) {
                    log.error("Failed to send rejection email to {}: {}", email, e.getMessage());
                }
            }
        }

        log.info("Rejected {} uninvited candidates for job {}.", sentTo.size(), jobId);
        return RejectResponse.builder()
                .rejectedCount(sentTo.size())
                .sentTo(sentTo)
                .build();
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    /**
     * Build the candidate-personalised assessment URL.
     * Including candidateId lets the assessment page auto-create the submission
     * record as soon as the candidate opens the link.
     */
    private String buildAssessmentLink(String token, UUID candidateAuthUserId) {
        String base = frontendUrl + "/assessments/" + token;
        return candidateAuthUserId != null
                ? base + "?candidateId=" + candidateAuthUserId
                : base;
    }

    /**
     * Render a polished, responsive HTML email body.
     */
    private String buildEmailHtml(String candidateName,
                                   String jobTitle,
                                   String assessmentTitle,
                                   Integer timeLimitMinutes,
                                   String assessmentLink) {

        String title = (assessmentTitle != null && !assessmentTitle.isBlank())
                ? assessmentTitle : "Technical Assessment";

        String timeLimit = timeLimitMinutes != null ? EmailTemplate.escape(timeLimitMinutes + " minutes") : null;
        String content = EmailTemplate.paragraph("Dear <strong>" + EmailTemplate.escape(candidateName) + "</strong>,")
                + EmailTemplate.paragraph("Congratulations on advancing in our hiring process. We'd like to invite you to complete an online assessment for the position of <strong>" + EmailTemplate.escape(jobTitle) + "</strong>. Please complete it at your earliest convenience.")
                + EmailTemplate.detailBox("Assessment Details", new String[][]{
                        {"Position", EmailTemplate.escape(jobTitle)},
                        {"Assessment", EmailTemplate.escape(title)},
                        {"Time Limit", timeLimit}
                })
                + EmailTemplate.button(assessmentLink, "Start Assessment")
                + EmailTemplate.fallbackLink(assessmentLink);
        return EmailTemplate.render("Online Assessment Invitation", content, "Please do not reply to this email.");
    }

    /**
     * Render a polished, responsive HTML rejection email body.
     */
    private String buildRejectionEmailHtml(String candidateName, String jobTitle) {
        String content = EmailTemplate.paragraph("Dear <strong>" + EmailTemplate.escape(candidateName) + "</strong>,")
                + EmailTemplate.paragraph("Thank you very much for taking the time to apply for the <strong>" + EmailTemplate.escape(jobTitle) + "</strong> role and for your interest in our team. We appreciate the opportunity to review your background and qualifications.")
                + EmailTemplate.paragraph("After careful consideration, we regret to inform you that we will not be moving forward with your application at this time. We had many qualified applicants, and we have decided to proceed with candidates whose experiences more closely match the current needs of the role.")
                + EmailTemplate.paragraph("We wish you all the best in your job search and your future professional endeavors.");
        return EmailTemplate.render("Application Update", content, "Please do not reply to this email.");
    }

    /**
     * Update the deadline for all assessment invites for a given job.
     */
    public void updateDeadlineForJob(UUID jobId, LocalDateTime newDeadline) {
        List<AssessmentInvite> invites = assessmentInviteRepository.findByJobId(jobId);
        for (AssessmentInvite invite : invites) {
            invite.setExpiresAt(newDeadline);
        }
        assessmentInviteRepository.saveAll(invites);
        log.info("Updated deadline for {} assessment invites for job {}", invites.size(), jobId);
    }
}
