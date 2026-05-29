package com.ats.jobs.dto;

import com.ats.jobs.enums.ApplicationStatus;
import lombok.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ApplicationDetailResponse {

    private UUID id;
    private UUID jobId;
    private UUID candidateAuthUserId;
    private String candidateName;
    private String candidateEmail;
    private String coverLetter;
    private List<String> portfolioLinks;
    private String contactPhone;
    private Map<String, Object> candidateProfileSnapshot;
    private String originalFilePath;
    private String originalFilename;
    private ApplicationStatus status;
    private Double parseConfidence;
    private Double compositeScore;
    private Double oaScore;
    private Double interviewScore;
    private Double finalRankingScore;
    private Integer rankingPosition;
    private Integer finalRank;
    private Boolean isWaitlisted;
    private String rejectionReason;
    private Boolean rejectionEmailSent;
    private String rejectionEmailError;
    private java.time.LocalDateTime rejectedAt;
    private java.util.UUID rejectedBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
