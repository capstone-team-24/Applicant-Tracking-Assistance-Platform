package com.ats.jobs.dto;

import com.ats.jobs.enums.ApplicationStatus;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class CandidateApplicationDetailResponse {

    private UUID id;
    private UUID jobId;
    private JobResponse job;
    private String candidateName;
    private String candidateEmail;
    private String coverLetter;
    private List<String> portfolioLinks;
    private String contactPhone;
    private Map<String, Object> candidateProfileSnapshot;
    private String originalFilename;
    private ApplicationStatus status;
    private String rejectionReason;
    private LocalDateTime rejectedAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
