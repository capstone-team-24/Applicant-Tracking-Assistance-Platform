package com.ats.notification;

import com.ats.notification.dto.NotificationEvent;
import com.ats.notification.dto.NotificationResponse;
import com.ats.notification.dto.SendNotificationRequest;
import com.ats.notification.entity.Notification;
import com.ats.notification.enums.NotificationChannel;
import com.ats.notification.enums.NotificationStatus;
import com.ats.notification.repository.NotificationRepository;
import com.ats.notification.service.NotificationService;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.mail.internet.MimeMessage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.mail.javamail.JavaMailSender;

import java.time.LocalDateTime;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class NotificationServiceTest {

    @Mock
    private NotificationRepository notificationRepository;

    @Mock
    private JavaMailSender mailSender;

    @Mock
    private MimeMessage mimeMessage;

    @Spy
    private ObjectMapper objectMapper = new ObjectMapper();

    @InjectMocks
    private NotificationService notificationService;

    @BeforeEach
    void setUp() {
        when(mailSender.createMimeMessage()).thenReturn(mimeMessage);
    }

    @Test
    void sendEmail_shouldCreateNotificationWithSentStatus() {
        // Arrange
        String recipientEmail = "candidate@example.com";
        String subject = "Test Subject";
        String body = "<html><body><p>Test body</p></body></html>";

        when(notificationRepository.save(any(Notification.class))).thenAnswer(invocation -> {
            Notification n = invocation.getArgument(0);
            n.setId(UUID.randomUUID());
            return n;
        });

        // Act
        Notification result = notificationService.sendEmail(recipientEmail, subject, body);

        // Assert
        assertThat(result).isNotNull();
        assertThat(result.getRecipientEmail()).isEqualTo(recipientEmail);
        assertThat(result.getSubject()).isEqualTo(subject);
        assertThat(result.getBody()).contains("data-email-template=\"ats-blue\"");
        assertThat(result.getBody()).contains("Test body");
        assertThat(result.getStatus()).isEqualTo(NotificationStatus.SENT);
        assertThat(result.getChannel()).isEqualTo(NotificationChannel.EMAIL);
        assertThat(result.getSentAt()).isNotNull();

        verify(mailSender).send(any(MimeMessage.class));
        verify(notificationRepository).save(any(Notification.class));
    }

    @Test
    void sendEmail_shouldMarkFailedOnException() {
        // Arrange
        String recipientEmail = "bad@example.com";
        String subject = "Fail Test";
        String body = "This should fail";

        doThrow(new RuntimeException("SMTP connection refused"))
                .when(mailSender).send(any(MimeMessage.class));

        when(notificationRepository.save(any(Notification.class))).thenAnswer(invocation -> {
            Notification n = invocation.getArgument(0);
            n.setId(UUID.randomUUID());
            return n;
        });

        // Act
        Notification result = notificationService.sendEmail(recipientEmail, subject, body);

        // Assert
        assertThat(result).isNotNull();
        assertThat(result.getStatus()).isEqualTo(NotificationStatus.FAILED);
        assertThat(result.getErrorMessage()).contains("SMTP connection refused");
        assertThat(result.getSentAt()).isNull();

        verify(notificationRepository).save(any(Notification.class));
    }

    @Test
    void processApplicationSubmitted_shouldSendEmailToCandidate() {
        // Arrange
        Map<String, Object> payload = new HashMap<>();
        payload.put("candidateEmail", "john.doe@example.com");
        payload.put("candidateName", "John Doe");
        payload.put("jobTitle", "Software Engineer");
        payload.put("applicationId", "APP-12345");

        NotificationEvent event = NotificationEvent.builder()
                .eventType("application.submitted")
                .payload(payload)
                .build();

        when(notificationRepository.save(any(Notification.class))).thenAnswer(invocation -> {
            Notification n = invocation.getArgument(0);
            if (n.getId() == null) {
                n.setId(UUID.randomUUID());
            }
            return n;
        });

        // Act
        notificationService.processApplicationSubmitted(event);

        // Assert
        ArgumentCaptor<Notification> captor = ArgumentCaptor.forClass(Notification.class);
        verify(notificationRepository, atLeast(1)).save(captor.capture());

        List<Notification> savedNotifications = captor.getAllValues();
        Notification lastSaved = savedNotifications.get(savedNotifications.size() - 1);

        assertThat(lastSaved.getRecipientEmail()).isEqualTo("john.doe@example.com");
        assertThat(lastSaved.getSubject()).contains("Application Received");
        assertThat(lastSaved.getSubject()).contains("Software Engineer");
        assertThat(lastSaved.getEventType()).isEqualTo("application.submitted");
        assertThat(lastSaved.getEventPayload()).isNotNull();

        verify(mailSender).send(any(MimeMessage.class));
    }

    @Test
    void processApplicationSubmitted_shouldSkipWhenNoEmail() {
        // Arrange
        Map<String, Object> payload = new HashMap<>();
        payload.put("candidateName", "No Email Candidate");

        NotificationEvent event = NotificationEvent.builder()
                .eventType("application.submitted")
                .payload(payload)
                .build();

        // Act
        notificationService.processApplicationSubmitted(event);

        // Assert
        verify(notificationRepository, never()).save(any(Notification.class));
        verify(mailSender, never()).send(any(MimeMessage.class));
    }

    @Test
    void processRankResult_shouldSendEmailToRecruiter() {
        // Arrange
        Map<String, Object> payload = new HashMap<>();
        payload.put("recruiterEmail", "recruiter@company.com");
        payload.put("jobTitle", "Backend Developer");
        payload.put("jobId", "JOB-001");
        payload.put("totalCandidates", "15");

        NotificationEvent event = NotificationEvent.builder()
                .eventType("job.rank.result")
                .payload(payload)
                .build();

        when(notificationRepository.save(any(Notification.class))).thenAnswer(invocation -> {
            Notification n = invocation.getArgument(0);
            if (n.getId() == null) {
                n.setId(UUID.randomUUID());
            }
            return n;
        });

        // Act
        notificationService.processRankResult(event);

        // Assert
        ArgumentCaptor<Notification> captor = ArgumentCaptor.forClass(Notification.class);
        verify(notificationRepository, atLeast(1)).save(captor.capture());

        List<Notification> savedNotifications = captor.getAllValues();
        Notification lastSaved = savedNotifications.get(savedNotifications.size() - 1);

        assertThat(lastSaved.getSubject()).contains("Ranking Complete");
        assertThat(lastSaved.getSubject()).contains("Backend Developer");
        assertThat(lastSaved.getEventType()).isEqualTo("job.rank.result");

        verify(mailSender).send(any(MimeMessage.class));
    }

    @Test
    void processParseCompleted_shouldLogWithoutRecruiterEmail() {
        // Arrange
        Map<String, Object> payload = new HashMap<>();
        payload.put("resumeId", "RESUME-001");
        payload.put("candidateName", "Jane Smith");
        payload.put("status", "SUCCESS");

        NotificationEvent event = NotificationEvent.builder()
                .eventType("resume.parse.completed")
                .payload(payload)
                .build();

        when(notificationRepository.save(any(Notification.class))).thenAnswer(invocation -> {
            Notification n = invocation.getArgument(0);
            if (n.getId() == null) {
                n.setId(UUID.randomUUID());
            }
            return n;
        });

        // Act
        notificationService.processParseCompleted(event);

        // Assert
        ArgumentCaptor<Notification> captor = ArgumentCaptor.forClass(Notification.class);
        verify(notificationRepository).save(captor.capture());

        Notification saved = captor.getValue();
        assertThat(saved.getChannel()).isEqualTo(NotificationChannel.IN_APP);
        assertThat(saved.getType()).isEqualTo("PARSE_COMPLETED");
        assertThat(saved.getStatus()).isEqualTo(NotificationStatus.SENT);

        // No email should be sent when recruiterEmail is absent
        verify(mailSender, never()).send(any(MimeMessage.class));
    }

    @Test
    void getNotifications_shouldReturnPaginatedResults() {
        // Arrange
        UUID userId = UUID.randomUUID();
        Pageable pageable = PageRequest.of(0, 10);

        Notification notification = Notification.builder()
                .id(UUID.randomUUID())
                .recipientUserId(userId)
                .recipientEmail("user@example.com")
                .type("EMAIL")
                .channel(NotificationChannel.EMAIL)
                .subject("Test")
                .body("Test body")
                .status(NotificationStatus.SENT)
                .sentAt(LocalDateTime.now())
                .createdAt(LocalDateTime.now())
                .build();

        Page<Notification> page = new PageImpl<>(List.of(notification), pageable, 1);
        when(notificationRepository.findByRecipientUserId(userId, pageable)).thenReturn(page);

        // Act
        Page<NotificationResponse> result = notificationService.getNotifications(userId, pageable);

        // Assert
        assertThat(result).isNotNull();
        assertThat(result.getTotalElements()).isEqualTo(1);
        assertThat(result.getContent().get(0).getRecipientEmail()).isEqualTo("user@example.com");
        assertThat(result.getContent().get(0).getStatus()).isEqualTo(NotificationStatus.SENT);
    }

    @Test
    void sendNotification_shouldSendAndReturnResponse() {
        // Arrange
        SendNotificationRequest request = SendNotificationRequest.builder()
                .recipientEmail("admin-target@example.com")
                .subject("Admin Notification")
                .body("Sent by admin")
                .type("ADMIN")
                .build();

        when(notificationRepository.save(any(Notification.class))).thenAnswer(invocation -> {
            Notification n = invocation.getArgument(0);
            if (n.getId() == null) {
                n.setId(UUID.randomUUID());
            }
            return n;
        });

        // Act
        NotificationResponse response = notificationService.sendNotification(request);

        // Assert
        assertThat(response).isNotNull();
        assertThat(response.getRecipientEmail()).isEqualTo("admin-target@example.com");
        assertThat(response.getSubject()).isEqualTo("Admin Notification");
        assertThat(response.getType()).isEqualTo("ADMIN");
        assertThat(response.getStatus()).isEqualTo(NotificationStatus.SENT);

        verify(mailSender).send(any(MimeMessage.class));
    }
}
