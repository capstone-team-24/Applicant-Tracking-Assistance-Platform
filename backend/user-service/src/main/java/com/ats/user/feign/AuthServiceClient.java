package com.ats.user.feign;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

import java.util.UUID;

/**
 * Feign client to call auth-service endpoints from user-service.
 * Used to create an org-admin invite token (and send the setup email)
 * when approving a contact-message registration.
 */
@FeignClient(
        name = "auth-service",
        url = "${auth.service.url}"
)
public interface AuthServiceClient {

    @PostMapping("/api/v1/auth/invite/org-admin")
    void inviteOrgAdmin(@RequestBody InviteOrgAdminRequest request);

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    class InviteOrgAdminRequest {
        private String email;
        private UUID orgId;
    }
}
