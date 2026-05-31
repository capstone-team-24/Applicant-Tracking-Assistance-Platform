package com.ats.jobs.dto;

import lombok.*;

import java.time.LocalDateTime;

/**
 * Request body for the individual (per-application) interview invite endpoint.
 * Unlike the bulk send-interview-invites flow, this does not require an
 * assessmentId, topN, or minScore — the recruiter is explicitly choosing a
 * single candidate, bypassing the OA score filter entirely.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SendSingleInterviewInviteRequest {

    /**
     * Optional deadline by which the candidate must book their interview slot.
     * Stored on the invite record and shown on the candidate dashboard.
     */
    private LocalDateTime expiresAt;
}
