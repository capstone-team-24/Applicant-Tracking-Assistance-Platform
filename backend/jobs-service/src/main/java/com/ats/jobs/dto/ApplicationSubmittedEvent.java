package com.ats.jobs.dto;

import lombok.*;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ApplicationSubmittedEvent {

    private UUID applicationId;
    private UUID jobId;
    private UUID candidateAuthUserId;
    private String filePath;
    private LocalDateTime createdAt;
    private String eventType;
    private Map<String, Object> payload;
}
