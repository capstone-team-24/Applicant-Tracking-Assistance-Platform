package com.ats.jobs.dto;

import com.ats.jobs.enums.ApplicationStatus;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ApplicationResponse {

    private UUID id;
    private UUID jobId;
    private UUID candidateAuthUserId;
    private JobResponse job;
    private String candidateName;
    private String candidateEmail;
    private ApplicationStatus status;
    private LocalDateTime createdAt;
    private Double compositeScore;
    private Integer rankingPosition;
}
