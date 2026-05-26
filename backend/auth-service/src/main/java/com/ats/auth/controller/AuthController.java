package com.ats.auth.controller;

import com.ats.auth.dto.AcceptInviteRequest;
import com.ats.auth.dto.InviteOrgAdminRequest;
import com.ats.auth.dto.InviteRecruiterRequest;
import com.ats.auth.dto.InviteTokenResponse;
import com.ats.auth.dto.JwksResponse;
import com.ats.auth.dto.LoginRequest;
import com.ats.auth.dto.LoginResponse;
import com.ats.auth.dto.RefreshRequest;
import com.ats.auth.dto.RefreshResponse;
import com.ats.auth.dto.SignupRequest;
import com.ats.auth.entity.AuthUser;
import com.ats.auth.service.AuthService;
import com.ats.auth.service.JwtService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
@Tag(name = "Authentication", description = "Auth endpoints for signup, login, refresh, logout, invites, and JWKS")
public class AuthController {

    private final AuthService authService;
    private final JwtService jwtService;

    // ──────────────────────────────────────────────────────────────
    //  Self-service signup / login
    // ──────────────────────────────────────────────────────────────

    @Operation(summary = "Register a new candidate")
    @PostMapping("/auth/signup")
    public ResponseEntity<Map<String, Object>> signup(@Valid @RequestBody SignupRequest request) {
        UUID userId = authService.signup(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(Map.of("userId", userId.toString(), "message", "User registered successfully"));
    }

    @Operation(summary = "Authenticate user and obtain tokens")
    @PostMapping("/auth/login")
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
        LoginResponse response = authService.login(request.getEmail(), request.getPassword());
        return ResponseEntity.ok(response);
    }

    @Operation(summary = "Refresh access token using a refresh token")
    @PostMapping("/auth/refresh")
    public ResponseEntity<RefreshResponse> refresh(@Valid @RequestBody RefreshRequest request) {
        RefreshResponse response = authService.refresh(request.getRefreshToken());
        return ResponseEntity.ok(response);
    }

    @Operation(summary = "Logout by revoking the refresh token")
    @PostMapping("/auth/logout")
    public ResponseEntity<Map<String, String>> logout(@Valid @RequestBody RefreshRequest request) {
        authService.logout(request.getRefreshToken());
        return ResponseEntity.ok(Map.of("message", "Logged out successfully"));
    }

    // ──────────────────────────────────────────────────────────────
    //  Invite: Org Admin (Platform Admin only)
    // ──────────────────────────────────────────────────────────────

    @Operation(summary = "Invite an Organization Admin by email (Platform Admin only)")
    @PostMapping("/auth/invite/org-admin")
    public ResponseEntity<Map<String, String>> inviteOrgAdmin(
            @Valid @RequestBody InviteOrgAdminRequest request) {
        authService.inviteOrgAdmin(request.getEmail(), request.getOrgId());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(Map.of("message", "Invite sent to " + request.getEmail()));
    }

    @Operation(summary = "Generate Org Admin invite token without sending email (Internal)")
    @PostMapping("/auth/internal/invite-org-admin-token")
    public ResponseEntity<Map<String, String>> generateOrgAdminInviteToken(
            @Valid @RequestBody InviteOrgAdminRequest request) {
        UUID token = authService.generateOrgAdminInviteToken(request.getEmail(), request.getOrgId());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(Map.of("token", token.toString()));
    }

    // ──────────────────────────────────────────────────────────────
    //  Invite: Recruiter (Org Admin only)
    // ──────────────────────────────────────────────────────────────

    @Operation(summary = "Invite a Recruiter by email (Org Admin only)")
    @PostMapping("/auth/invite/recruiter")
    public ResponseEntity<Map<String, String>> inviteRecruiter(
            @Valid @RequestBody InviteRecruiterRequest request,
            @RequestHeader(value = "X-Org-Id", required = false) String orgIdHeader) {
        if (orgIdHeader == null || orgIdHeader.isBlank()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        authService.inviteRecruiter(request.getEmail(), request.getFirstName(), request.getLastName(),
                UUID.fromString(orgIdHeader));
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(Map.of("message", "Invite sent to " + request.getEmail()));
    }

    // ──────────────────────────────────────────────────────────────
    //  Invite: Validate token (public – no auth required)
    // ──────────────────────────────────────────────────────────────

    @Operation(summary = "Validate an invite token and return invite metadata")
    @GetMapping("/auth/invite/validate")
    public ResponseEntity<InviteTokenResponse> validateInvite(@RequestParam UUID token) {
        InviteTokenResponse response = authService.validateInviteToken(token);
        return ResponseEntity.ok(response);
    }

    // ──────────────────────────────────────────────────────────────
    //  Invite: Accept – creates the account (public – no auth required)
    // ──────────────────────────────────────────────────────────────

    @Operation(summary = "Accept an invite and create the account")
    @PostMapping("/auth/invite/accept")
    public ResponseEntity<Map<String, Object>> acceptInvite(
            @Valid @RequestBody AcceptInviteRequest request) {
        UUID userId = authService.acceptInvite(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(Map.of("userId", userId.toString(), "message", "Account created successfully. You can now log in."));
    }

    // ──────────────────────────────────────────────────────────────
    //  Recruiters – list / create (legacy endpoints kept for reference;
    //  creation now uses invite flow above)
    // ──────────────────────────────────────────────────────────────

    @Operation(summary = "Get all recruiters for an organization (Org Admin only)")
    @GetMapping("/auth/org/recruiters")
    public ResponseEntity<List<AuthUser>> getRecruiters(
            @RequestHeader(value = "X-Org-Id", required = false) String orgIdHeader) {
        if (orgIdHeader == null || orgIdHeader.isBlank()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        return ResponseEntity.ok(authService.getRecruiters(UUID.fromString(orgIdHeader)));
    }

    @Operation(summary = "Suspend or unsuspend a recruiter (Org Admin only)")
    @PutMapping("/auth/org/recruiters/{id}/suspend")
    public ResponseEntity<Map<String, String>> suspendRecruiter(
            @PathVariable UUID id,
            @RequestParam boolean suspend,
            @RequestHeader(value = "X-Org-Id", required = false) String orgIdHeader) {
        if (orgIdHeader == null || orgIdHeader.isBlank()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        authService.suspendRecruiter(id, UUID.fromString(orgIdHeader), suspend);
        return ResponseEntity.ok(Map.of("message", "Recruiter suspension updated successfully"));
    }

    // ──────────────────────────────────────────────────────────────
    //  Platform Admin – Org Admin management (global, no org scope)
    // ──────────────────────────────────────────────────────────────

    @Operation(summary = "List all Org Admin accounts (Platform Admin only)")
    @GetMapping("/auth/platform-admin/org-admins")
    public ResponseEntity<List<AuthUser>> getAllOrgAdmins() {
        return ResponseEntity.ok(authService.getAllOrgAdmins());
    }

    @Operation(summary = "Suspend or unsuspend an Org Admin (Platform Admin only)")
    @PutMapping("/auth/platform-admin/org-admins/{id}/suspend")
    public ResponseEntity<Map<String, String>> suspendOrgAdmin(
            @PathVariable UUID id,
            @RequestParam boolean suspend) {
        authService.suspendOrgAdmin(id, suspend);
        return ResponseEntity.ok(Map.of("message", "Org admin suspension updated successfully"));
    }

    @Operation(summary = "Get all admins and recruiters for an organization (Platform Admin only)")
    @GetMapping("/auth/platform-admin/organizations/{orgId}/members")
    public ResponseEntity<List<AuthUser>> getOrgMembers(@PathVariable UUID orgId) {
        return ResponseEntity.ok(authService.getOrgMembers(orgId));
    }

    @Operation(summary = "Suspend or unsuspend any org member (Platform Admin only)")
    @PutMapping("/auth/platform-admin/org-members/{id}/suspend")
    public ResponseEntity<Map<String, String>> suspendOrgMember(
            @PathVariable UUID id,
            @RequestParam boolean suspend) {
        authService.suspendOrgMember(id, suspend);
        return ResponseEntity.ok(Map.of("message", "Member suspension updated successfully"));
    }

    // ──────────────────────────────────────────────────────────────
    //  JWKS / Key rotation
    // ──────────────────────────────────────────────────────────────

    @Operation(summary = "Get JSON Web Key Set for token verification")
    @GetMapping("/.well-known/jwks.json")
    public ResponseEntity<JwksResponse> jwks() {
        return ResponseEntity.ok(jwtService.getJwks());
    }

    @Operation(summary = "Rotate RSA signing keys")
    @PostMapping("/auth/keys/rotate")
    public ResponseEntity<Map<String, String>> rotateKeys() {
        jwtService.rotateKeys();
        return ResponseEntity.ok(Map.of("message", "Keys rotated successfully"));
    }
}
