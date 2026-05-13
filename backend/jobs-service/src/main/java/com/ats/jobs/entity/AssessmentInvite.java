package com.ats.jobs.entity;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.domain.Persistable;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "assessment_invite")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AssessmentInvite implements Persistable<UUID> {

    @Id
    private UUID id;

    @Override
    @Transient
    public boolean isNew() {
        return sentAt == null;
    }

    @Column(name = "job_id", nullable = false)
    private UUID jobId;

    @Column(name = "application_id")
    private UUID applicationId;

    @Column(name = "candidate_auth_user_id", nullable = false)
    private UUID candidateAuthUserId;

    @Column(name = "candidate_email")
    private String candidateEmail;

    @Column(name = "job_title", nullable = false)
    private String jobTitle;

    @Column(name = "assessment_token", nullable = false)
    private String assessmentToken;

    @Column(name = "assessment_title")
    private String assessmentTitle;

    @Column(name = "time_limit_minutes")
    private Integer timeLimitMinutes;

    @Column(name = "sent_at", nullable = false, updatable = false)
    private LocalDateTime sentAt;

    @Column(name = "expires_at")
    private LocalDateTime expiresAt;

    @PrePersist
    protected void onCreate() {
        if (id == null) {
            id = UUID.randomUUID();
        }
        if (sentAt == null) {
            sentAt = LocalDateTime.now();
        }
    }
}
