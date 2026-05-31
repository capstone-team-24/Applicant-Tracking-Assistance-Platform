package com.ats.user.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Used by the organization to revise their registration details
 * after receiving an inquiry from the platform admin.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateContactMessageRequest {
    /** Updated message / description from the org */
    @NotBlank(message = "Message is required")
    private String message;

    /** Updated HR admin name */
    private String hrAdminName;

    /** Updated company details */
    private String companyDetails;
}
