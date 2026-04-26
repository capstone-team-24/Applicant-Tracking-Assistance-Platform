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
import com.ats.jobs.repository.ApplicationRepository;
import com.ats.jobs.repository.InterviewInviteRepository;
import com.ats.jobs.repository.JobRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.*;

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
                String body = buildEmailHtml(candidateName, job.getTitle(), score, schedulingUrl);
                notificationServiceClient.sendNotification(NotificationSendRequest.builder()
                        .recipientEmail(email)
                        .subject(subject)
                        .body(body)
                        .type("INTERVIEW_INVITE")
                        .build());

                // Update application status
                app.setStatus(ApplicationStatus.INTERVIEW_INVITED);
                applicationRepository.save(app);

                // Persist invite for candidate dashboard
                interviewInviteRepository.save(InterviewInvite.builder()
                        .jobId(jobId)
                        .applicationId(app.getId())
                        .candidateAuthUserId(candidateId)
                        .candidateEmail(email)
                        .jobTitle(job.getTitle())
                        .oaScore(score)
                        .schedulingUrl(schedulingUrl)
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

    private String buildEmailHtml(String candidateName, String jobTitle,
                                   double oaScore, String schedulingUrl) {
        return "<!DOCTYPE html>" +
               "<html lang=\"en\"><head><meta charset=\"UTF-8\">" +
               "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"></head>" +
               "<body style=\"margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;\">" +
               "<table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" role=\"presentation\">" +
               "<tr><td align=\"center\" style=\"padding:40px 16px;\">" +
               "<table width=\"600\" cellpadding=\"0\" cellspacing=\"0\" role=\"presentation\" " +
               "style=\"background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);\">" +
               // Header
               "<tr><td style=\"background:#059669;padding:28px 36px;\">" +
               "<p style=\"margin:0;font-size:13px;color:#a7f3d0;letter-spacing:.5px;text-transform:uppercase;\">ATS Recruitment</p>" +
               "<h1 style=\"margin:6px 0 0;font-size:22px;color:#ffffff;font-weight:700;\">Interview Invitation 🎉</h1>" +
               "</td></tr>" +
               // Body
               "<tr><td style=\"padding:36px 36px 28px;\">" +
               "<p style=\"margin:0 0 16px;font-size:15px;color:#374151;\">Dear <strong>" + escHtml(candidateName) + "</strong>,</p>" +
               "<p style=\"margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;\">" +
               "Congratulations! You performed excellently on the Online Assessment for <strong>" + escHtml(jobTitle) + "</strong> " +
               "and we would like to invite you to the next stage — a formal interview.</p>" +
               // Score box
               "<div style=\"background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px 24px;margin-bottom:28px;text-align:center;\">" +
               "<p style=\"margin:0;font-size:13px;color:#065f46;font-weight:700;text-transform:uppercase;letter-spacing:.4px;\">Your OA Score</p>" +
               "<p style=\"margin:4px 0 0;font-size:36px;font-weight:800;color:#059669;\">" + Math.round(oaScore) + "<span style=\"font-size:16px;color:#6b7280;\"> / 100</span></p>" +
               "</div>" +
               // CTA
               "<div style=\"text-align:center;margin-bottom:28px;\">" +
               "<a href=\"" + schedulingUrl + "\" " +
               "style=\"display:inline-block;background:#059669;color:#ffffff;font-size:16px;font-weight:700;" +
               "text-decoration:none;padding:14px 40px;border-radius:8px;\">Book Interview &rarr;</a>" +
               "</div>" +
               "<p style=\"font-size:13px;color:#6b7280;margin:0 0 6px;\">If the button doesn't work, copy and paste this link:</p>" +
               "<p style=\"font-size:13px;color:#059669;word-break:break-all;margin:0 0 28px;\">" + schedulingUrl + "</p>" +
               "<hr style=\"border:none;border-top:1px solid #e5e7eb;margin:0 0 20px;\">" +
               "<p style=\"font-size:12px;color:#9ca3af;text-align:center;margin:0;\">" +
               "This invitation was sent automatically by the ATS Recruitment System.</p>" +
               "</td></tr></table>" +
               "</td></tr></table></body></html>";
    }

    private static String escHtml(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#x27;");
    }

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
                "Thank you for taking the time to complete the Online Assessment for the <strong>" + escHtml(jobTitle) + "</strong> role. " +
                "We appreciate the effort you put into the assessment and your continued interest in our team.</p>" +
                "<p style=\"margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;\">" +
                "After careful consideration of the assessment results and profiles of all candidates, we regret to inform you that we will not be moving forward with your application to the interview stage at this time. " +
                "We had many highly qualified applicants and have decided to proceed with candidates whose scores and experiences more closely match the current needs of the role.</p>" +
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
