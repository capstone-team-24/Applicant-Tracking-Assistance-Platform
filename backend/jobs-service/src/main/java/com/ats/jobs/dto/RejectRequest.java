package com.ats.jobs.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RejectRequest {
    /** Optional reason / feedback to include in the rejection email and store on the application. */
    private String reason;

    /** For bulk rejection: the list of application IDs to reject. Ignored on single-reject endpoints. */
    private List<UUID> applicationIds;
}
