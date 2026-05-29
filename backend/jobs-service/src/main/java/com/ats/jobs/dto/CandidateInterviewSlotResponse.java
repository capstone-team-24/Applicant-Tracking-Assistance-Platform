package com.ats.jobs.dto;

import com.ats.jobs.entity.InterviewSlot;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CandidateInterviewSlotResponse {
    private UUID id;
    private UUID jobId;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private InterviewSlot.SlotStatus status;
}
