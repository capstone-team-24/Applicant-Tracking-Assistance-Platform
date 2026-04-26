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
    private Integer rankingPosition;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
