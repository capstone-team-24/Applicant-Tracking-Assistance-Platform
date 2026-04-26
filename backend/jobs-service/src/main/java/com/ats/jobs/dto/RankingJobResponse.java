package com.ats.jobs.dto;

import com.ats.jobs.enums.RankingStatus;
import lombok.*;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RankingJobResponse {

    private UUID id;
    private UUID jobId;
    private RankingStatus status;
    private Map<String, Object> result;
    private LocalDateTime createdAt;
    private LocalDateTime completedAt;
}
