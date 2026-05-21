package com.ats.jobs.entity;

import jakarta.persistence.*;
import lombok.*;
import com.fasterxml.jackson.annotation.JsonFormat;
import org.springframework.data.domain.Persistable;
import org.springframework.data.domain.Persistable;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "interview_bookings")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InterviewBooking implements Persistable<UUID> {

    @Id
    private UUID id;

    @Override
    @Transient
    public boolean isNew() {
        return createdAt == null;
    }

    @Column(name = "slot_id", nullable = false, unique = true)
    private UUID slotId;

    @Column(name = "application_id", nullable = false)
    private UUID applicationId;

    @Column(name = "candidate_auth_user_id", nullable = false)
    private UUID candidateAuthUserId;

    @Column(name = "meeting_link")
    private String meetingLink;

    @Column(name = "status", nullable = false)
    @Enumerated(EnumType.STRING)
    private BookingStatus status;

    @Column(name = "created_at", nullable = false, updatable = false)
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", timezone = "UTC")
    private LocalDateTime createdAt;

    @Column(name = "feedback", columnDefinition = "TEXT")
    private String feedback;

    @Column(name = "rating")
    private Integer rating;

    @Column(name = "technical_score")
    private Integer technical;

    @Column(name = "problem_solving_score")
    private Integer problemSolving;

    @Column(name = "communication_score")
    private Integer communication;

    @Column(name = "behavioral_score")
    private Integer behavioral;

    @Column(name = "culture_fit_score")
    private Integer cultureFit;

    public enum BookingStatus {
        SCHEDULED,
        COMPLETED,
        CANCELLED
    }

    @PrePersist
    protected void onCreate() {
        if (id == null) {
            id = UUID.randomUUID();
        }
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
        if (status == null) {
            status = BookingStatus.SCHEDULED;
        }
    }
}
