package com.ats.jobs.dto;

import lombok.*;
import java.time.LocalDate;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SendOfferRequest {
    private String offerMessage;
    private String salary;
    private LocalDate startDate;
}
