package com.ats.jobs.entity;

import com.ats.jobs.enums.ApplicationStatus;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import org.springframework.data.domain.Persistable;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "application")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Application implements Persistable<UUID> {

    @Id
    private UUID id;

    @Override
    @Transient
    public boolean isNew() {
        return createdAt == null;
    }

    @Column(name = "job_id", nullable = false)
    private UUID jobId;

    @Column(name = "candidate_auth_user_id")
    private UUID candidateAuthUserId;

    @Column(name = "candidate_email")
    private String candidateEmail;

    @Column(name = "candidate_name")
    private String candidateName;

    @Column(name = "cover_letter", columnDefinition = "TEXT")
    private String coverLetter;

    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "portfolio_links", columnDefinition = "TEXT[]")
    private List<String> portfolioLinks;

    @Column(name = "contact_phone")
    private String contactPhone;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "candidate_profile_snapshot", columnDefinition = "jsonb")
    private Map<String, Object> candidateProfileSnapshot;

    @Column(name = "original_file_path")
    private String originalFilePath;

    @Column(name = "original_filename")
    private String originalFilename;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ApplicationStatus status;

    @Column(name = "parse_confidence")
    private Double parseConfidence;

    @Column(name = "composite_score")
    private Double compositeScore;

    @Column(name = "interview_score")
    private Double interviewScore;

    @Column(name = "ranking_position")
    private Integer rankingPosition;

    @Column(name = "oa_score")
    private Double oaScore;

    @Column(name = "final_ranking_score")
    private Double finalRankingScore;

    @Column(name = "final_rank")
    private Integer finalRank;

    @Column(name = "rejection_reason", columnDefinition = "TEXT")
    private String rejectionReason;

    @Column(name = "rejected_at")
    private LocalDateTime rejectedAt;

    @Column(name = "rejected_by")
    private UUID rejectedBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (status == null) {
            status = ApplicationStatus.APPLIED;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
