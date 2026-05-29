package com.ats.notification.service;

import com.ats.notification.dto.NotificationEvent;
import com.ats.notification.dto.NotificationResponse;
import com.ats.notification.dto.SendNotificationRequest;
import com.ats.notification.entity.Notification;
import com.ats.notification.enums.NotificationChannel;
import com.ats.notification.enums.NotificationStatus;
import com.ats.notification.repository.NotificationRepository;
import com.ats.notification.util.EmailTemplate;
import com.ats.notification.websocket.NotificationWebSocketHandler;
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
    private final NotificationWebSocketHandler webSocketHandler;

    /**
     * Send an email to the specified recipient. Creates a notification record
     * with SENT status on success or FAILED status on error.
     */
    @Transactional
    public Notification sendEmail(String recipientEmail, String subject, String body) {
        return sendEmail(recipientEmail, null, "EMAIL", subject, body, null, null);
    }

    private Notification sendEmail(String recipientEmail, UUID recipientUserId, String type, String subject, String body,
                                   String eventType, String eventPayload) {
        log.info("Sending email to {} with subject: {}", recipientEmail, subject);
        String emailBody = normalizeEmailBody(subject, body);

        Notification notification = Notification.builder()
                .recipientUserId(recipientUserId)
                .recipientEmail(recipientEmail)
                .type(type)
                .channel(NotificationChannel.EMAIL)
                .subject(subject)
                .body(emailBody)
                .eventType(eventType)
                .eventPayload(eventPayload)
                .status(NotificationStatus.PENDING)
                .createdAt(LocalDateTime.now())
                .build();

        try {
            MimeMessage mimeMessage = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, true, "UTF-8");
            helper.setTo(recipientEmail);
            helper.setSubject(subject);
            helper.setText(emailBody, true);
            helper.setFrom("noreply@ats-system.com");

            mailSender.send(mimeMessage);

            notification.setStatus(NotificationStatus.SENT);
            notification.setSentAt(LocalDateTime.now());
            log.info("Email sent successfully to {}", recipientEmail);
        } catch (MessagingException | RuntimeException e) {
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
        UUID candidateUserId = getUuidValue(payload, "candidateAuthUserId");

        if (candidateEmail == null || candidateEmail.isBlank()) {
            log.warn("No candidate email found in application.submitted event payload; skipping notification.");
            return;
        }

        String subject = "Application Received - " + (jobTitle != null ? jobTitle : "Your Application");
        String body = buildApplicationReceivedEmail(candidateName, jobTitle, applicationId);
        String eventPayload = serializePayload(payload);

        Notification notification = sendEmail(candidateEmail, candidateUserId, "APPLICATION_SUBMITTED", subject, body,
                event.getEventType(), eventPayload);
        pushIfRecipientConnected(notification);
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
        Notification notification = sendEmail(request.getRecipientEmail(), request.getRecipientUserId(), request.getType(),
                request.getSubject(), request.getBody(), null, null);
        pushIfRecipientConnected(notification);
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

    private UUID getUuidValue(Map<String, Object> payload, String key) {
        String value = getStringValue(payload, key);
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return UUID.fromString(value);
        } catch (IllegalArgumentException e) {
            log.warn("Invalid UUID value for {} in notification payload: {}", key, value);
            return null;
        }
    }

    private void pushIfRecipientConnected(Notification notification) {
        if (notification.getRecipientUserId() == null || notification.getStatus() != NotificationStatus.SENT) {
            return;
        }
        webSocketHandler.sendToUser(notification.getRecipientUserId(), toResponse(notification));
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
        String name = candidateName != null ? candidateName : "Applicant";
        String position = jobTitle != null ? " for the position of <strong>" + EmailTemplate.escape(jobTitle) + "</strong>" : "";
        String reference = applicationId != null
                ? EmailTemplate.detailBox("Application Details", new String[][]{{"Reference", EmailTemplate.escape(applicationId)}})
                : "";
        String content = EmailTemplate.paragraph("Dear <strong>" + EmailTemplate.escape(name) + "</strong>,")
                + EmailTemplate.paragraph("Thank you for submitting your application" + position + ".")
                + reference
                + EmailTemplate.paragraph("We have received your application and our team will review it shortly. You will be notified of any updates regarding your application status.")
                + EmailTemplate.paragraph("Best regards,<br/><strong>ATS Recruitment Team</strong>");
        return EmailTemplate.render("Application Received", content);
    }

    private String buildParseCompletedEmail(String candidateName, String resumeId, String status) {
        String name = candidateName != null ? candidateName : "Unknown";
        String parseStatus = status != null ? status : "COMPLETED";
        String content = EmailTemplate.paragraph("The resume for candidate <strong>" + EmailTemplate.escape(name) + "</strong> has been successfully parsed.")
                + EmailTemplate.detailBox("Parse Details", new String[][]{
                        {"Resume ID", resumeId != null ? EmailTemplate.escape(resumeId) : null},
                        {"Status", EmailTemplate.escape(parseStatus)}
                })
                + EmailTemplate.paragraph("You can now review the extracted information in the ATS dashboard.")
                + EmailTemplate.paragraph("Best regards,<br/><strong>ATS System</strong>");
        return EmailTemplate.render("Resume Parse Completed", content);
    }

    private String buildRankResultEmail(String jobTitle, String jobId, String totalCandidates) {
        String target = jobTitle != null
                ? "the position of <strong>" + EmailTemplate.escape(jobTitle) + "</strong>"
                : "Job ID <strong>" + EmailTemplate.escape(jobId != null ? jobId : "N/A") + "</strong>";
        String content = EmailTemplate.paragraph("The candidate ranking process has been completed for " + target + ".")
                + EmailTemplate.detailBox("Ranking Details", new String[][]{{"Candidates Ranked", totalCandidates != null ? EmailTemplate.escape(totalCandidates) : null}})
                + EmailTemplate.paragraph("Please log in to the ATS dashboard to review the ranked candidates and proceed with the next steps.")
                + EmailTemplate.paragraph("Best regards,<br/><strong>ATS System</strong>");
        return EmailTemplate.render("Candidate Ranking Complete", content);
    }

    private String normalizeEmailBody(String subject, String body) {
        if (body != null && body.contains("data-email-template=\"ats-blue\"")) {
            return body;
        }
        String content = body == null || body.isBlank()
                ? EmailTemplate.paragraph("No message body was provided.")
                : body;
        return EmailTemplate.render(subject != null && !subject.isBlank() ? subject : "Notification", content);
    }
}
