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
import com.ats.jobs.repository.ApplicationRepository;
import com.ats.jobs.repository.AssessmentInviteRepository;
import com.ats.jobs.repository.JobRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class AssessmentInviteService {

    private final ApplicationRepository applicationRepository;
    private final JobRepository jobRepository;
    private final NotificationServiceClient notificationServiceClient;
    private final AssessmentInviteRepository assessmentInviteRepository;

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
                        assessmentInviteRepository.save(AssessmentInvite.builder()
                                .jobId(jobId)
                                .applicationId(app.getId())
                                .candidateAuthUserId(app.getCandidateAuthUserId())
                                .candidateEmail(email)
                                .jobTitle(job.getTitle())
                                .assessmentToken(request.getAssessmentToken())
                                .assessmentTitle(request.getAssessmentTitle())
                                .timeLimitMinutes(request.getTimeLimitMinutes())
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

        return "<!DOCTYPE html>" +
                "<html lang=\"en\"><head><meta charset=\"UTF-8\">" +
                "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"></head>" +
                "<body style=\"margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;\">" +

                "<table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" role=\"presentation\">" +
                "<tr><td align=\"center\" style=\"padding:40px 16px;\">" +

                // Card
                "<table width=\"600\" cellpadding=\"0\" cellspacing=\"0\" role=\"presentation\" " +
                "style=\"background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);\">" +

                // ── Header band
                "<tr><td style=\"background:#4f46e5;padding:28px 36px;\">" +
                "<p style=\"margin:0;font-size:13px;color:#c7d2fe;letter-spacing:.5px;text-transform:uppercase;\">ATS Recruitment</p>" +
                "<h1 style=\"margin:6px 0 0;font-size:22px;color:#ffffff;font-weight:700;\">Online Assessment Invitation</h1>" +
                "</td></tr>" +

                // ── Body
                "<tr><td style=\"padding:36px 36px 28px;\">" +

                "<p style=\"margin:0 0 16px;font-size:15px;color:#374151;\">Dear <strong>" + escHtml(candidateName) + "</strong>,</p>" +

                "<p style=\"margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;\">" +
                "Congratulations on advancing in our hiring process! We'd like to invite you to complete an online " +
                "assessment for the position of <strong>" + escHtml(jobTitle) + "</strong>. " +
                "Please complete it at your earliest convenience.</p>" +

                // Details box
                "<div style=\"background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:20px 24px;margin-bottom:28px;\">" +
                "<p style=\"margin:0 0 12px;font-size:13px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.4px;\">Assessment Details</p>" +
                "<table cellpadding=\"0\" cellspacing=\"0\" width=\"100%\">" +
                "<tr>" +
                "<td style=\"color:#6b7280;font-size:14px;padding:5px 0;width:130px;\">Position</td>" +
                "<td style=\"color:#111827;font-size:14px;font-weight:600;padding:5px 0;\">" + escHtml(jobTitle) + "</td>" +
                "</tr>" +
                "<tr>" +
                "<td style=\"color:#6b7280;font-size:14px;padding:5px 0;\">Assessment</td>" +
                "<td style=\"color:#111827;font-size:14px;font-weight:600;padding:5px 0;\">" + escHtml(title) + "</td>" +
                "</tr>" +
                (timeLimitMinutes != null
                        ? "<tr><td style=\"color:#6b7280;font-size:14px;padding:5px 0;\">Time Limit</td>" +
                          "<td style=\"color:#111827;font-size:14px;font-weight:600;padding:5px 0;\">" + timeLimitMinutes + " minutes</td></tr>"
                        : "") +
                "</table>" +
                "</div>" +

                // CTA button
                "<div style=\"text-align:center;margin-bottom:28px;\">" +
                "<a href=\"" + assessmentLink + "\" " +
                "style=\"display:inline-block;background:#4f46e5;color:#ffffff;font-size:16px;font-weight:700;" +
                "text-decoration:none;padding:14px 40px;border-radius:8px;\">Start Assessment &rarr;</a>" +
                "</div>" +

                // Fallback link
                "<p style=\"font-size:13px;color:#6b7280;margin:0 0 6px;\">If the button above doesn't work, copy and paste this link into your browser:</p>" +
                "<p style=\"font-size:13px;color:#4f46e5;word-break:break-all;margin:0 0 28px;\">" + assessmentLink + "</p>" +

                // Divider + footer note
                "<hr style=\"border:none;border-top:1px solid #e5e7eb;margin:0 0 20px;\">" +
                "<p style=\"font-size:12px;color:#9ca3af;text-align:center;margin:0;\">" +
                "This invitation was sent automatically by the ATS Recruitment System. Please do not reply to this email." +
                "</p>" +

                "</td></tr>" +
                "</table>" + // end card
                "</td></tr></table>" + // end outer table
                "</body></html>";
    }

    /** Minimal HTML escaping to prevent injection in email bodies. */
    private static String escHtml(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#x27;");
    }

    /**
     * Render a polished, responsive HTML rejection email body.
     */
    private String buildRejectionEmailHtml(String candidateName, String jobTitle) {
        return "<!DOCTYPE html>" +
                "<html lang=\"en\"><head><meta charset=\"UTF-8\">" +
                "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"></head>" +
                "<body style=\"margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;\">" +
                "<table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" role=\"presentation\">" +
                "<tr><td align=\"center\" style=\"padding:40px 16px;\">" +
                "<table width=\"600\" cellpadding=\"0\" cellspacing=\"0\" role=\"presentation\" " +
                "style=\"background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);\">" +
                "<tr><td style=\"background:#1f2937;padding:28px 36px;\">" + // Dark grey header
                "<p style=\"margin:0;font-size:13px;color:#9ca3af;letter-spacing:.5px;text-transform:uppercase;\">ATS Recruitment</p>" +
                "<h1 style=\"margin:6px 0 0;font-size:22px;color:#ffffff;font-weight:700;\">Application Update</h1>" +
                "</td></tr>" +
                "<tr><td style=\"padding:36px 36px 28px;\">" +
                "<p style=\"margin:0 0 16px;font-size:15px;color:#374151;\">Dear <strong>" + escHtml(candidateName) + "</strong>,</p>" +
                "<p style=\"margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;\">" +
                "Thank you very much for taking the time to apply for the <strong>" + escHtml(jobTitle) + "</strong> role and for your interest in our team. " +
                "We appreciate the opportunity to review your background and qualifications.</p>" +
                "<p style=\"margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;\">" +
                "After careful consideration, we regret to inform you that we will not be moving forward with your application at this time. " +
                "We had many qualified applicants, and we have decided to proceed with candidates whose experiences more closely match the current needs of the role.</p>" +
                "<p style=\"margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;\">" +
                "We wish you all the best in your job search and your future professional endeavors.</p>" +
                "<hr style=\"border:none;border-top:1px solid #e5e7eb;margin:0 0 20px;\">" +
                "<p style=\"font-size:12px;color:#9ca3af;text-align:center;margin:0;\">" +
                "This message was sent automatically by the ATS Recruitment System. Please do not reply to this email." +
                "</p>" +
                "</td></tr>" +
                "</table>" +
                "</td></tr></table>" +
                "</body></html>";
    }
}
