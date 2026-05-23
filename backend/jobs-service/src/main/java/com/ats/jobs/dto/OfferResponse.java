package com.ats.jobs.dto;

import lombok.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OfferResponse {
    private UUID id;
    private UUID applicationId;
    private String jobTitle;
    private String companyName;
    private String candidateName;
    private String offerMessage;
    private String salary;
    private LocalDate startDate;
    private String status;
    private LocalDateTime sentAt;
    private LocalDateTime acceptedAt;
    private LocalDateTime declinedAt;
}
