package com.ats.jobs.controller;

import com.ats.jobs.entity.UserIntegration;
import com.ats.jobs.repository.UserIntegrationRepository;
import com.ats.jobs.util.HeaderContext;
import com.google.api.client.googleapis.auth.oauth2.GoogleAuthorizationCodeFlow;
import com.google.api.client.googleapis.auth.oauth2.GoogleTokenResponse;
import com.google.api.client.googleapis.javanet.GoogleNetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Collections;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/integrations/google")
@RequiredArgsConstructor
@Slf4j
public class GoogleIntegrationController {

    private final UserIntegrationRepository userIntegrationRepository;

    @Value("${google.client.id:}")
    private String clientId;

    @Value("${google.client.secret:}")
    private String clientSecret;

    @Value("${app.frontend-url:http://localhost:3000}")
    private String frontendUrl;

    private String getRedirectUri() {
        return frontendUrl + "/integrations/google/callback";
    }

    @GetMapping("/auth-url")
    public ResponseEntity<Map<String, String>> getAuthUrl(HttpServletRequest request) {
        UUID authUserId = HeaderContext.getAuthUserId(request);
        if (authUserId == null) {
            return ResponseEntity.status(401).build();
        }

        try {
            GoogleAuthorizationCodeFlow flow = new GoogleAuthorizationCodeFlow.Builder(
                    GoogleNetHttpTransport.newTrustedTransport(),
                    GsonFactory.getDefaultInstance(),
                    clientId,
                    clientSecret,
                    Collections.singleton("https://www.googleapis.com/auth/calendar.events"))
                    .setAccessType("offline")
                    .setApprovalPrompt("force")
                    .build();

            String redirectUri = getRedirectUri();
            String url = flow.newAuthorizationUrl().setRedirectUri(redirectUri).build();

            return ResponseEntity.ok(Collections.singletonMap("url", url));
        } catch (Exception e) {
            log.error("Failed to generate Google Auth URL", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    @GetMapping("/status")
    public ResponseEntity<Map<String, Boolean>> getStatus(HttpServletRequest request) {
        UUID authUserId = HeaderContext.getAuthUserId(request);
        if (authUserId == null) {
            return ResponseEntity.status(401).build();
        }
        boolean connected = userIntegrationRepository.findByAuthUserId(authUserId)
                .map(integration -> integration.getGoogleRefreshToken() != null && !integration.getGoogleRefreshToken().isEmpty())
                .orElse(false);
        return ResponseEntity.ok(Collections.singletonMap("connected", connected));
    }

    @PostMapping("/callback")
    public ResponseEntity<Map<String, String>> handleCallback(@RequestBody Map<String, String> body, HttpServletRequest request) {
        UUID authUserId = HeaderContext.getAuthUserId(request);
        if (authUserId == null) {
            return ResponseEntity.status(401).build();
        }

        String code = body.get("code");
        if (code == null || code.isEmpty()) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("message", "Authorization code is missing"));
        }

        try {
            GoogleAuthorizationCodeFlow flow = new GoogleAuthorizationCodeFlow.Builder(
                    GoogleNetHttpTransport.newTrustedTransport(),
                    GsonFactory.getDefaultInstance(),
                    clientId,
                    clientSecret,
                    Collections.singleton("https://www.googleapis.com/auth/calendar.events"))
                    .build();

            String redirectUri = getRedirectUri();
            GoogleTokenResponse response = flow.newTokenRequest(code).setRedirectUri(redirectUri).execute();

            String refreshToken = response.getRefreshToken();
            if (refreshToken == null) {
                // If it's not the first time, google might not return a refresh token unless approval_prompt=force was used
                return ResponseEntity.badRequest().body(Collections.singletonMap("message", "No refresh token received. Try revoking access and reconnecting."));
            }

            UserIntegration integration = userIntegrationRepository.findByAuthUserId(authUserId)
                    .orElse(UserIntegration.builder()
                            .authUserId(authUserId)
                            .build());

            integration.setGoogleRefreshToken(refreshToken);
            userIntegrationRepository.save(integration);

            return ResponseEntity.ok(Collections.singletonMap("message", "Successfully connected Google Calendar"));

        } catch (Exception e) {
            log.error("Failed to handle Google callback", e);
            return ResponseEntity.internalServerError().body(Collections.singletonMap("message", "Failed to connect Google Calendar"));
        }
    }
}
