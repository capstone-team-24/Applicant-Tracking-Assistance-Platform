package com.ats.jobs.dto;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SendInterviewInviteRequest {

    /** The assessment ID to pull scored submissions from. */
    private String assessmentId;

    /** How many top-scored candidates to invite. Defaults to 10. */
    private Integer topN;

    /** Optional minimum OA score (0–100) to qualify. */
    private Double minScore;
}
