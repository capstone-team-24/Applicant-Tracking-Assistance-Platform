package com.ats.jobs.dto;

import lombok.*;

import java.time.LocalDateTime;

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

    /** Email for the recruiter pressing Send OA, used as the candidate appeal contact. */
    private String senderEmail;

    /** When true, sending the OA must first clear an existing disqualified attempt. */
    private Boolean resetDisqualification;

    /**
     * Optional deadline by which the candidate must complete the OA.
     * Stored on each invite record and shown on the candidate dashboard.
     * Once this datetime has passed, the invite is shown as expired.
     */
    private LocalDateTime expiresAt;
}
