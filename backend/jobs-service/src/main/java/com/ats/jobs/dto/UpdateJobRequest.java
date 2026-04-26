package com.ats.jobs.dto;

import lombok.*;

import java.util.List;
import java.util.Map;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UpdateJobRequest {

    private String title;

    private String description;

    private String requirements;

    private String location;

    private String employmentType;

    private String experienceLevel;

    private List<String> skills;

    private Map<String, Object> scoringWeights;

    private Map<String, Object> customScoringRules;
}
