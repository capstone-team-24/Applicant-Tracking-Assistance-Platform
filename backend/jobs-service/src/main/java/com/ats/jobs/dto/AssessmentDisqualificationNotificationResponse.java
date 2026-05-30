package com.ats.jobs.dto;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AssessmentDisqualificationNotificationResponse {
    private boolean sent;
    private String appealContactEmail;
    private String errorMessage;
}
