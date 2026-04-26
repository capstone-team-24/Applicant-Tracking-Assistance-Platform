package com.ats.user.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ApplicationDataResponse {

    private String firstName;
    private String lastName;
    private String email;
    private String phone;
    private String latestCvUrl;
    private Integer yearsOfExperience;
}
