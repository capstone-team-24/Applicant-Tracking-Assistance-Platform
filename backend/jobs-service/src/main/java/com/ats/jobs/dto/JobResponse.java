package com.ats.jobs.dto;

import com.ats.jobs.enums.JobStatus;
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
public class JobResponse {

    private UUID id;
    private UUID orgId;
    private String title;
    private String description;
    private String requirements;
    private String location;
    private String employmentType;
    private String experienceLevel;
    private List<String> skills;
    private Map<String, Object> scoringWeights;
    private Map<String, Object> customScoringRules;
    private JobStatus status;
    private UUID createdBy;
    private UUID assignedTo;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private LocalDateTime publishedAt;
    private LocalDateTime closedAt;
    private LocalDateTime applicationDeadline;
}
