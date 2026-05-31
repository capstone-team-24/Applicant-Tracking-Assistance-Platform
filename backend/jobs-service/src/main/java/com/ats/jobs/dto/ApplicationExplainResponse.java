package com.ats.jobs.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.*;

import java.util.List;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ApplicationExplainResponse {

    private UUID applicationId;
    private UUID jobId;
    private UUID candidateAuthUserId;
    private Double score;
    private Analysis analysis;
    private String analysisError;

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class Analysis {
        private String summary;
        private List<String> strengths;
        private String gap;
        private String recommendation;
    }
}
