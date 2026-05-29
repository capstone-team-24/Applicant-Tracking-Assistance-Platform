package com.ats.jobs.repository;

import com.ats.jobs.entity.InterviewSlot;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Repository
public interface InterviewSlotRepository extends JpaRepository<InterviewSlot, UUID> {
    List<InterviewSlot> findByJobIdAndStatusAndStartTimeAfterOrderByStartTimeAsc(UUID jobId, InterviewSlot.SlotStatus status, LocalDateTime startTime);
    List<InterviewSlot> findByJobIdAndStartTimeAfterOrderByStartTimeAsc(UUID jobId, LocalDateTime startTime);
    List<InterviewSlot> findByJobIdAndRecruiterAuthUserIdAndStartTimeAfterOrderByStartTimeAsc(UUID jobId, UUID recruiterAuthUserId, LocalDateTime startTime);
    List<InterviewSlot> findByRecruiterAuthUserIdAndStartTimeAfterOrderByStartTimeAsc(UUID recruiterAuthUserId, LocalDateTime startTime);
}
