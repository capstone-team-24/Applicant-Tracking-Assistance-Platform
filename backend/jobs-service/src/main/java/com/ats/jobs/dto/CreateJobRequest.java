package com.ats.jobs.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CreateJobRequest {

    @NotBlank(message = "Title is required")
    private String title;

    private String description;

    private String requirements;

    private String location;

    private String employmentType;

    private String experienceLevel;

    private List<String> skills;

    private Map<String, Object> scoringWeights;

    private Map<String, Object> customScoringRules;

    /**
     * Optional deadline after which the job no longer accepts applications.
     * When this datetime passes, the scheduler auto-closes the job and it
     * is removed from the public listings.
     */
    private LocalDateTime applicationDeadline;
}
