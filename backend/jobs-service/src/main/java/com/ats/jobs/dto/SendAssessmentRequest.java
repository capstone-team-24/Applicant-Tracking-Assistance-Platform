package com.ats.jobs.dto;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SendAssessmentRequest {

    /** The assessment access token (opaque UUID string from assessment-service). */
    private String assessmentToken;

    /** Human-readable assessment title shown in the invitation email. */
    private String assessmentTitle;

    /** Time limit in minutes, displayed in the email body (nullable). */
    private Integer timeLimitMinutes;

    /** How many top-ranked candidates to invite. Defaults to 10 when null or <= 0. */
    private Integer topN;
}
