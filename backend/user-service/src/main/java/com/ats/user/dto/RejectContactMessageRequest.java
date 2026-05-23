package com.ats.user.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RejectContactMessageRequest {
    /** Optional reason for rejection (shown in the rejection email) */
    private String reason;
}
