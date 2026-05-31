package com.ats.user.controller;

import com.ats.user.dto.ApplicationDataResponse;
import com.ats.user.dto.ProfileResponse;
import com.ats.user.dto.ProfileUpdateRequest;
import com.ats.user.service.UserProfileService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.UUID;

@RestController
@RequestMapping("/profiles")
@RequiredArgsConstructor
@Tag(name = "Profiles", description = "User profile management")
public class ProfileController {

    private final UserProfileService userProfileService;

    @GetMapping("/{id}")
    @Operation(summary = "Get profile by ID")
    public ResponseEntity<ProfileResponse> getProfile(@PathVariable UUID id) {
        ProfileResponse response = userProfileService.getProfile(id);
        return ResponseEntity.ok(response);
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update profile by ID (ownership check via X-User-Id header)")
    public ResponseEntity<ProfileResponse> updateProfile(
            @PathVariable UUID id,
            @RequestBody ProfileUpdateRequest request,
            @RequestHeader("X-User-Id") String requestingUserId) {
        ProfileResponse response = userProfileService.updateProfile(id, request, requestingUserId);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/me")
    @Operation(summary = "Get current user's profile (via X-User-Id header)")
    public ResponseEntity<ProfileResponse> getMyProfile(
            @RequestHeader("X-User-Id") String userId) {
        ProfileResponse response = userProfileService.getProfileByAuthUserId(UUID.fromString(userId));
        return ResponseEntity.ok(response);
    }

    @PutMapping("/me")
    @Operation(summary = "Update current user's profile (via X-User-Id header)")
    public ResponseEntity<ProfileResponse> updateMyProfile(
            @RequestBody ProfileUpdateRequest request,
            @RequestHeader("X-User-Id") String userId) {
        ProfileResponse profile = userProfileService.getProfileByAuthUserId(UUID.fromString(userId));
        ProfileResponse response = userProfileService.updateProfile(profile.getId(), request, userId);
        return ResponseEntity.ok(response);
    }

    @PostMapping(value = "/{id}/upload-cv", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Upload CV for a profile")
    public ResponseEntity<ProfileResponse> uploadCv(
            @PathVariable UUID id,
            @RequestParam("file") MultipartFile file,
            @RequestHeader(value = "X-Org-Id", required = false) String orgId) {
        ProfileResponse response = userProfileService.uploadCv(id, file, orgId);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{id}/application-data")
    @Operation(summary = "Get application data for a profile by profile ID")
    public ResponseEntity<ApplicationDataResponse> getApplicationData(@PathVariable UUID id) {
        ProfileResponse profile = userProfileService.getProfile(id);
        ApplicationDataResponse response = userProfileService.getApplicationData(profile.getAuthUserId());
        return ResponseEntity.ok(response);
    }
}
