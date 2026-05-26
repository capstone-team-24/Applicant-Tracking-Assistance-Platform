package com.ats.user.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "contact_message")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ContactMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    @Column(columnDefinition = "uuid", updatable = false, nullable = false)
    private UUID id;

    @Column(nullable = false, length = 255)
    private String name;

    @Column(nullable = false, length = 255)
    private String email;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String message;

    /** HR admin contact name submitted by the organization */
    @Column(name = "hr_admin_name", length = 255)
    private String hrAdminName;

    /** Additional company details / description submitted by the org */
    @Column(name = "company_details", columnDefinition = "TEXT")
    private String companyDetails;

    /** Workflow status – default PENDING_APPROVAL on creation */
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 30)
    @Builder.Default
    private ContactMessageStatus status = ContactMessageStatus.PENDING_APPROVAL;

    /** Admin's inquiry message sent to the org when status → PENDING_RESPONSE */
    @Column(name = "inquiry_message", columnDefinition = "TEXT")
    private String inquiryMessage;

    /** Optional reason provided by admin when rejecting */
    @Column(name = "rejection_reason", columnDefinition = "TEXT")
    private String rejectionReason;

    /** Timestamp when the submission was rejected */
    @Column(name = "rejected_at")
    private LocalDateTime rejectedAt;

    @Column(name = "approved_at")
    private LocalDateTime approvedAt;

    @Column(name = "approved_organization_id", columnDefinition = "uuid")
    private UUID approvedOrganizationId;

    @Column(name = "revision_token", length = 255, unique = true)
    private String revisionToken;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        if (status == null) {
            status = ContactMessageStatus.PENDING_APPROVAL;
        }
    }
}
