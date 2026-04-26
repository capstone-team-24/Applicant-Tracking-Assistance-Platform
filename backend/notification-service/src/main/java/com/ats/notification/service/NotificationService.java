package com.ats.notification.service;

import com.ats.notification.dto.NotificationEvent;
import com.ats.notification.dto.NotificationResponse;
import com.ats.notification.dto.SendNotificationRequest;
import com.ats.notification.entity.Notification;
import com.ats.notification.enums.NotificationChannel;
import com.ats.notification.enums.NotificationStatus;
import com.ats.notification.repository.NotificationRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final JavaMailSender mailSender;
    private final ObjectMapper objectMapper;

    /**
     * Send an email to the specified recipient. Creates a notification record
     * with SENT status on success or FAILED status on error.
     */
    @Transactional
    public Notification sendEmail(String recipientEmail, String subject, String body) {
        log.info("Sending email to {} with subject: {}", recipientEmail, subject);

        Notification notification = Notification.builder()
                .recipientEmail(recipientEmail)
                .type("EMAIL")
                .channel(NotificationChannel.EMAIL)
                .subject(subject)
                .body(body)
                .status(NotificationStatus.PENDING)
                .createdAt(LocalDateTime.now())
                .build();

        try {
            MimeMessage mimeMessage = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, true, "UTF-8");
            helper.setTo(recipientEmail);
            helper.setSubject(subject);
            helper.setText(body, true);
            helper.setFrom("noreply@ats-system.com");

            mailSender.send(mimeMessage);

            notification.setStatus(NotificationStatus.SENT);
            notification.setSentAt(LocalDateTime.now());
            log.info("Email sent successfully to {}", recipientEmail);
        } catch (MessagingException e) {
            log.error("Failed to send email to {}: {}", recipientEmail, e.getMessage(), e);
            notification.setStatus(NotificationStatus.FAILED);
            notification.setErrorMessage(e.getMessage());
        }

        return notificationRepository.save(notification);
    }

    /**
     * Process an APPLICATION_SUBMITTED event. Extracts the candidate info
     * from the event payload and sends an "Application Received" confirmation email.
     */
    @Transactional
    public void processApplicationSubmitted(NotificationEvent event) {
        log.info("Processing application.submitted event");
        Map<String, Object> payload = event.getPayload();

        String candidateEmail = getStringValue(payload, "candidateEmail");
        String candidateName = getStringValue(payload, "candidateName");
        String jobTitle = getStringValue(payload, "jobTitle");
        String applicationId = getStringValue(payload, "applicationId");

        if (candidateEmail == null || candidateEmail.isBlank()) {
            log.warn("No candidate email found in application.submitted event payload; skipping notification.");
            return;
        }

        String subject = "Application Received - " + (jobTitle != null ? jobTitle : "Your Application");
        String body = buildApplicationReceivedEmail(candidateName, jobTitle, applicationId);

        Notification notification = sendEmail(candidateEmail, subject, body);
        notification.setEventType(event.getEventType());
        notification.setEventPayload(serializePayload(payload));
        notificationRepository.save(notification);
    }

    /**
     * Process a RESUME_PARSE_COMPLETED event. Logs the parse results
     * and optionally notifies the recruiter.
     */
    @Transactional
    public void processParseCompleted(NotificationEvent event) {
        log.info("Processing resume.parse.completed event");
        Map<String, Object> payload = event.getPayload();

        String resumeId = getStringValue(payload, "resumeId");
        String candidateName = getStringValue(payload, "candidateName");
        String status = getStringValue(payload, "status");
        String recruiterEmail = getStringValue(payload, "recruiterEmail");

        log.info("Resume parse completed - resumeId: {}, candidate: {}, status: {}",
                resumeId, candidateName, status);

        if (recruiterEmail != null && !recruiterEmail.isBlank()) {
            String subject = "Resume Parsed Successfully - " + (candidateName != null ? candidateName : "Unknown Candidate");
            String body = buildParseCompletedEmail(candidateName, resumeId, status);

            Notification notification = sendEmail(recruiterEmail, subject, body);
            notification.setEventType(event.getEventType());
            notification.setEventPayload(serializePayload(payload));
            notificationRepository.save(notification);
        } else {
            log.info("No recruiter email in parse.completed payload; logging only.");
            Notification notification = Notification.builder()
                    .type("PARSE_COMPLETED")
                    .channel(NotificationChannel.IN_APP)
                    .eventType(event.getEventType())
                    .eventPayload(serializePayload(payload))
                    .subject("Resume Parse Completed")
                    .body("Resume parse completed for candidate: " + candidateName)
                    .status(NotificationStatus.SENT)
                    .sentAt(LocalDateTime.now())
                    .createdAt(LocalDateTime.now())
                    .build();
            notificationRepository.save(notification);
        }
    }

    /**
     * Process a JOB_RANK_RESULT event. Composes a "Ranking Complete" notification
     * and sends it to the recruiter.
     */
    @Transactional
    public void processRankResult(NotificationEvent event) {
        log.info("Processing job.rank.result event");
        Map<String, Object> payload = event.getPayload();

        String jobId = getStringValue(payload, "jobId");
        String jobTitle = getStringValue(payload, "jobTitle");
        String recruiterEmail = getStringValue(payload, "recruiterEmail");
        String totalCandidates = getStringValue(payload, "totalCandidates");

        if (recruiterEmail == null || recruiterEmail.isBlank()) {
            log.warn("No recruiter email found in rank.result event payload; skipping notification.");
            return;
        }

        String subject = "Ranking Complete - " + (jobTitle != null ? jobTitle : "Job " + jobId);
        String body = buildRankResultEmail(jobTitle, jobId, totalCandidates);

        Notification notification = sendEmail(recruiterEmail, subject, body);
        notification.setEventType(event.getEventType());
        notification.setEventPayload(serializePayload(payload));
        notificationRepository.save(notification);
    }

    /**
     * Return a paginated list of notifications for a given user.
     */
    @Transactional(readOnly = true)
    public Page<NotificationResponse> getNotifications(UUID userId, Pageable pageable) {
        log.info("Fetching notifications for user {}", userId);
        return notificationRepository.findByRecipientUserId(userId, pageable)
                .map(this::toResponse);
    }

    /**
     * Retrieve a single notification by id.
     */
    @Transactional(readOnly = true)
    public NotificationResponse getNotificationById(UUID id) {
        log.info("Fetching notification {}", id);
        Notification notification = notificationRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Notification not found with id: " + id));
        return toResponse(notification);
    }

    /**
     * Create a webhook-style notification record (placeholder for future webhook integrations).
     */
    @Transactional
    public NotificationResponse createWebhookNotification(SendNotificationRequest request) {
        log.info("Creating webhook notification for {}", request.getRecipientEmail());

        Notification notification = Notification.builder()
                .recipientEmail(request.getRecipientEmail())
                .type(request.getType())
                .channel(NotificationChannel.WEBHOOK)
                .subject(request.getSubject())
                .body(request.getBody())
                .status(NotificationStatus.PENDING)
                .createdAt(LocalDateTime.now())
                .build();

        notification = notificationRepository.save(notification);
        return toResponse(notification);
    }

    /**
     * Admin endpoint: send an arbitrary notification email.
     */
    @Transactional
    public NotificationResponse sendNotification(SendNotificationRequest request) {
        Notification notification = sendEmail(request.getRecipientEmail(), request.getSubject(), request.getBody());
        notification.setType(request.getType());
        notification = notificationRepository.save(notification);
        return toResponse(notification);
    }

    // ---- Private helpers ----

    private NotificationResponse toResponse(Notification n) {
        return NotificationResponse.builder()
                .id(n.getId())
                .recipientUserId(n.getRecipientUserId())
                .recipientEmail(n.getRecipientEmail())
                .type(n.getType())
                .channel(n.getChannel())
                .subject(n.getSubject())
                .body(n.getBody())
                .eventType(n.getEventType())
                .eventPayload(n.getEventPayload())
                .status(n.getStatus())
                .sentAt(n.getSentAt())
                .errorMessage(n.getErrorMessage())
                .createdAt(n.getCreatedAt())
                .build();
    }

    private String getStringValue(Map<String, Object> payload, String key) {
        if (payload == null || !payload.containsKey(key)) {
            return null;
        }
        Object value = payload.get(key);
        return value != null ? value.toString() : null;
    }

    private String serializePayload(Map<String, Object> payload) {
        try {
            return objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException e) {
            log.error("Failed to serialize event payload: {}", e.getMessage());
            return "{}";
        }
    }

    private String buildApplicationReceivedEmail(String candidateName, String jobTitle, String applicationId) {
        StringBuilder sb = new StringBuilder();
        sb.append("<html><body>");
        sb.append("<h2>Application Received</h2>");
        sb.append("<p>Dear ").append(candidateName != null ? candidateName : "Applicant").append(",</p>");
        sb.append("<p>Thank you for submitting your application");
        if (jobTitle != null) {
            sb.append(" for the position of <strong>").append(jobTitle).append("</strong>");
        }
        sb.append(".</p>");
        if (applicationId != null) {
            sb.append("<p>Your application reference number is: <strong>").append(applicationId).append("</strong></p>");
        }
        sb.append("<p>We have received your application and our team will review it shortly. ");
        sb.append("You will be notified of any updates regarding your application status.</p>");
        sb.append("<p>Best regards,<br/>ATS Recruitment Team</p>");
        sb.append("</body></html>");
        return sb.toString();
    }

    private String buildParseCompletedEmail(String candidateName, String resumeId, String status) {
        StringBuilder sb = new StringBuilder();
        sb.append("<html><body>");
        sb.append("<h2>Resume Parse Completed</h2>");
        sb.append("<p>The resume for candidate <strong>")
                .append(candidateName != null ? candidateName : "Unknown")
                .append("</strong> has been successfully parsed.</p>");
        if (resumeId != null) {
            sb.append("<p>Resume ID: <strong>").append(resumeId).append("</strong></p>");
        }
        sb.append("<p>Parse Status: <strong>").append(status != null ? status : "COMPLETED").append("</strong></p>");
        sb.append("<p>You can now review the extracted information in the ATS dashboard.</p>");
        sb.append("<p>Best regards,<br/>ATS System</p>");
        sb.append("</body></html>");
        return sb.toString();
    }

    private String buildRankResultEmail(String jobTitle, String jobId, String totalCandidates) {
        StringBuilder sb = new StringBuilder();
        sb.append("<html><body>");
        sb.append("<h2>Candidate Ranking Complete</h2>");
        sb.append("<p>The candidate ranking process has been completed for ");
        if (jobTitle != null) {
            sb.append("the position of <strong>").append(jobTitle).append("</strong>");
        } else {
            sb.append("Job ID: <strong>").append(jobId != null ? jobId : "N/A").append("</strong>");
        }
        sb.append(".</p>");
        if (totalCandidates != null) {
            sb.append("<p>Total candidates ranked: <strong>").append(totalCandidates).append("</strong></p>");
        }
        sb.append("<p>Please log in to the ATS dashboard to review the ranked candidates and proceed with the next steps.</p>");
        sb.append("<p>Best regards,<br/>ATS System</p>");
        sb.append("</body></html>");
        return sb.toString();
    }
}
