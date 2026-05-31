package com.ats.user.controller;

import com.ats.user.dto.ApplicationDataResponse;
import com.ats.user.dto.BootstrapProfileRequest;
import com.ats.user.dto.ProfileResponse;
import com.ats.user.service.UserProfileService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/internal/profiles")
@RequiredArgsConstructor
@Tag(name = "Internal Profiles", description = "Internal profile endpoints for service-to-service communication")
public class InternalProfileController {

    private final UserProfileService userProfileService;

    @PostMapping("/bootstrap")
    @Operation(summary = "Bootstrap a new user profile (called by auth-service)")
    public ResponseEntity<ProfileResponse> bootstrapProfile(
            @Valid @RequestBody BootstrapProfileRequest request) {
        ProfileResponse response = userProfileService.bootstrapProfile(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/{authUserId}/application-data")
    @Operation(summary = "Get application data by authUserId (internal)")
    public ResponseEntity<ApplicationDataResponse> getApplicationData(
            @PathVariable UUID authUserId) {
        ApplicationDataResponse response = userProfileService.getApplicationData(authUserId);
        return ResponseEntity.ok(response);
    }
}
