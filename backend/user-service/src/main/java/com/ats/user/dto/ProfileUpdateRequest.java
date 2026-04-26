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
    private String bio;
    private Integer yearsOfExperience;
}
