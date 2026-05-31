package com.ats.jobs.dto;

import lombok.*;

import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class NotificationSendRequest {
    private String recipientEmail;
    private UUID recipientUserId;
    private String subject;
    private String body;
    private String type;
}
