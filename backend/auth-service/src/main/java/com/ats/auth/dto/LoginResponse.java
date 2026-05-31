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
public class LoginResponse {

    private String accessToken;
    private String refreshToken;
    private long expiresIn;
    private UUID userId;
    private Role role;
    private UUID orgId;
    private String email;
    private String firstName;
    private String lastName;
}
