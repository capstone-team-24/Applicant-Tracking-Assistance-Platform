package com.ats.jobs.dto;

import lombok.*;

import java.util.List;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RankRequestEvent {

    private UUID jobId;
    private UUID rankingJobId;
    private List<UUID> applicationIds;
}
