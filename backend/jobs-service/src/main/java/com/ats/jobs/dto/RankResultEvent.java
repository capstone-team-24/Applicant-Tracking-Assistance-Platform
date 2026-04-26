package com.ats.jobs.dto;

import lombok.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RankResultEvent {

    private UUID jobId;
    private UUID rankingJobId;
    private String status;
    private List<RankedApplication> rankings;
    private Map<String, Object> metadata;

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class RankedApplication {
        private UUID applicationId;
        private Double compositeScore;
        private Integer rankingPosition;
    }
}
