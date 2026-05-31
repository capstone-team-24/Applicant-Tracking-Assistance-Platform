package com.ats.auth.dto;

import com.ats.auth.entity.Role;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InviteTokenResponse {

    private UUID token;
    private String email;
    private Role role;
    private UUID orgId;
    private String firstName;
    private String lastName;
    private LocalDateTime expiresAt;
}
