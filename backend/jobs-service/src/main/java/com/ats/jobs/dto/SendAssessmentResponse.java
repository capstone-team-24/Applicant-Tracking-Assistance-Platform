package com.ats.jobs.dto;

import lombok.*;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SendAssessmentResponse {

    /** Number of invites successfully sent. */
    private int sent;

    /** Number of candidates skipped (no email or send failure). */
    private int skipped;

    /** Email addresses that received an invite. */
    private List<String> sentTo;

    /** Human-readable reasons for each skipped candidate. */
    private List<String> skippedReasons;
}
