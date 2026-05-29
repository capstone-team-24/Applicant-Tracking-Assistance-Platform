package com.ats.notification.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.*;

import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SendNotificationRequest {

    @NotBlank(message = "Recipient email is required")
    @Email(message = "Recipient email must be a valid email address")
    private String recipientEmail;

    private UUID recipientUserId;

    @NotBlank(message = "Subject is required")
    private String subject;

    @NotBlank(message = "Body is required")
    private String body;

    @NotBlank(message = "Notification type is required")
    private String type;
}
