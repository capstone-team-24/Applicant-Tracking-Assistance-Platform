package com.ats.user.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProfileUpdateRequest {

    private String firstName;
    private String lastName;
    private String phone;
    private String headline;
    private String location;
    private String bio;
    private String linkedinUrl;
    private String portfolioUrl;
    private String websiteUrl;
    private Integer yearsOfExperience;
}
