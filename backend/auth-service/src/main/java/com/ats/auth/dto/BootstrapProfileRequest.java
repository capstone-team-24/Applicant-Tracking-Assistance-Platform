package com.ats.auth.dto;

import com.ats.auth.entity.Role;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BootstrapProfileRequest {

    private UUID authUserId;
    private String firstName;
    private String lastName;
    private String email;
    private Role role;
    private UUID orgId;
}
