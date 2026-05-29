package com.ats.jobs.entity;

import com.ats.jobs.enums.JobStatus;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Entity
@Table(name = "jobs")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Job {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "org_id", nullable = false)
    private UUID orgId;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(columnDefinition = "TEXT")
    private String requirements;

    private String location;

    @Column(name = "employment_type")
    private String employmentType;

    @Column(name = "experience_level")
    private String experienceLevel;

    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "skills", columnDefinition = "TEXT[]")
    private List<String> skills;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "scoring_weights", columnDefinition = "jsonb")
    private Map<String, Object> scoringWeights;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "custom_scoring_rules", columnDefinition = "jsonb")
    private Map<String, Object> customScoringRules;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private JobStatus status;

    @Column(name = "created_by", nullable = false)
    private UUID createdBy;

    @Column(name = "assigned_to")
    private UUID assignedTo;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(
            name = "job_recruiter_assignments",
            joinColumns = @JoinColumn(name = "job_id")
    )
    @Column(name = "recruiter_auth_user_id", nullable = false)
    @Builder.Default
    private Set<UUID> assignedRecruiterIds = new LinkedHashSet<>();

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Column(name = "published_at")
    private LocalDateTime publishedAt;

    @Column(name = "closed_at")
    private LocalDateTime closedAt;

    @Column(name = "application_deadline")
    private LocalDateTime applicationDeadline;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (status == null) {
            status = JobStatus.DRAFT;
        }
        syncAssignments(true);
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
        syncAssignments(false);
    }

    public Set<UUID> getEffectiveAssignedRecruiterIds() {
        Set<UUID> effective = new LinkedHashSet<>();
        if (assignedRecruiterIds != null) {
            effective.addAll(assignedRecruiterIds);
        }
        if (effective.isEmpty() && assignedTo != null) {
            effective.add(assignedTo);
        }
        return effective;
    }

    public boolean isAssignedTo(UUID recruiterId) {
        return recruiterId != null && getEffectiveAssignedRecruiterIds().contains(recruiterId);
    }

    public void replaceAssignedRecruiters(List<UUID> recruiterIds) {
        assignedRecruiterIds = new LinkedHashSet<>();
        if (recruiterIds != null) {
            recruiterIds.stream()
                    .filter(id -> id != null)
                    .forEach(assignedRecruiterIds::add);
        }
        assignedTo = assignedRecruiterIds.stream().findFirst().orElse(null);
    }

    private void syncAssignments(boolean defaultToCreator) {
        if (assignedRecruiterIds == null) {
            assignedRecruiterIds = new LinkedHashSet<>();
        }
        if (assignedRecruiterIds.isEmpty()) {
            if (assignedTo != null) {
                assignedRecruiterIds.add(assignedTo);
            } else if (defaultToCreator && createdBy != null) {
                assignedRecruiterIds.add(createdBy);
            }
        }
        assignedTo = assignedRecruiterIds.stream().findFirst().orElse(null);
    }
}
