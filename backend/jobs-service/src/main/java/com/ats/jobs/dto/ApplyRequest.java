package com.ats.jobs.dto;

import lombok.*;

import java.util.List;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ApplyRequest {

    private UUID candidateAuthUserId;

    private String coverLetter;

    private List<String> portfolioLinks;

    private String contactPhone;

    private boolean useProfileData;
}
