package com.ats.notification.dto;

import com.ats.notification.enums.NotificationChannel;
import com.ats.notification.enums.NotificationStatus;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class NotificationResponse {

    private UUID id;
    private UUID recipientUserId;
    private String recipientEmail;
    private String type;
    private NotificationChannel channel;
    private String subject;
    private String body;
    private String eventType;
    private String eventPayload;
    private NotificationStatus status;
    private LocalDateTime sentAt;
    private String errorMessage;
    private LocalDateTime createdAt;
}
