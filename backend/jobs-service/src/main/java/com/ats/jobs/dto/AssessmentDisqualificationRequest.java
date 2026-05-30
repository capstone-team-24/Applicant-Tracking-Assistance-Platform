package com.ats.jobs.dto;

import lombok.*;

import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AssessmentDisqualificationRequest {
    private String assessmentToken;
    private UUID jobId;
    private UUID candidateAuthUserId;
    private Integer strikeCount;
    private String disqualifiedAt;
}
