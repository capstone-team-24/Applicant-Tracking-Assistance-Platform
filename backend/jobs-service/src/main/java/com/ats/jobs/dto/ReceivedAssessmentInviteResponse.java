package com.ats.jobs.dto;

import lombok.*;

import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ReceivedAssessmentInviteResponse {
    private UUID id;
    private UUID jobId;
    private String jobTitle;
    private String organizationName;
    private String assessmentToken;
    private String assessmentTitle;
    private Integer timeLimitMinutes;
    private String sentAt;
    private String expiresAt;
    private String appealContactEmail;
}
