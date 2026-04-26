package com.ats.jobs.dto;

import lombok.*;

import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ReceivedInterviewInviteResponse {
    private UUID id;
    private UUID jobId;
    private String jobTitle;
    private Double oaScore;
    private String schedulingUrl;
    private String sentAt;
}
