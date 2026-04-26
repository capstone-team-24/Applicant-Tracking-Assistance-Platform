package com.ats.jobs.dto;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class NotificationSendRequest {
    private String recipientEmail;
    private String subject;
    private String body;
    private String type;
}
