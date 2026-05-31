package com.ats.jobs.dto;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ApplicationDataResponse {

    private String firstName;
    private String lastName;
    private String email;
    private String phone;
    private String latestCvUrl;
    private Integer yearsOfExperience;

    public String getFullName() {
        if (firstName == null && lastName == null) return null;
        return ((firstName != null ? firstName : "") + " " + (lastName != null ? lastName : "")).trim();
    }
}
