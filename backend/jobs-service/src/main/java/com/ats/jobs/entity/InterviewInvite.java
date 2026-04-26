package com.ats.jobs.entity;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.domain.Persistable;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "interview_invite")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InterviewInvite implements Persistable<UUID> {

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

    @Column(name = "oa_score")
    private Double oaScore;

    @Column(name = "scheduling_url")
    private String schedulingUrl;

    @Column(name = "sent_at", nullable = false, updatable = false)
    private LocalDateTime sentAt;

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
