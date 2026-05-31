package com.ats.user.dto;

import com.ats.user.entity.ContactMessageStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ContactMessageResponse {
    private UUID id;
    private String name;
    private String email;
    private String message;
    private String hrAdminName;
    private String companyDetails;
    private ContactMessageStatus status;
    private String inquiryMessage;
    private String rejectionReason;
    private LocalDateTime rejectedAt;
    private LocalDateTime approvedAt;
    private UUID approvedOrganizationId;
    private LocalDateTime createdAt;
}

