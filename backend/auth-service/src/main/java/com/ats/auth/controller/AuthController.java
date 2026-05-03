package com.ats.auth.controller;

import com.ats.auth.dto.JwksResponse;
import com.ats.auth.dto.LoginRequest;
import com.ats.auth.dto.LoginResponse;
import com.ats.auth.dto.RefreshRequest;
import com.ats.auth.dto.RefreshResponse;
import com.ats.auth.dto.SignupRequest;
import com.ats.auth.dto.CreateRecruiterRequest;
import com.ats.auth.service.AuthService;
import com.ats.auth.service.JwtService;
import com.ats.auth.entity.AuthUser;
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
@Tag(name = "Authentication", description = "Auth endpoints for signup, login, refresh, logout, and JWKS")
public class AuthController {

    private final AuthService authService;
    private final JwtService jwtService;

    @Operation(summary = "Register a new user")
    @PostMapping("/auth/signup")
    public ResponseEntity<Map<String, Object>> signup(@Valid @RequestBody SignupRequest request) {
        UUID userId = authService.signup(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(Map.of("userId", userId.toString(), "message", "User registered successfully"));
    }

    @Operation(summary = "Create an Organization Admin (Platform Admin only)")
    @PostMapping("/auth/org-admin")
    public ResponseEntity<Map<String, Object>> createOrgAdmin(@Valid @RequestBody com.ats.auth.dto.CreateOrgAdminRequest request) {
        // Ideally this is secured by a role check. Since auth is centralized, gateway might enforce it or we do it here.
        // Assuming gateway enforces /api/v1/auth/org-admin, but actually path is /auth/org-admin
        UUID userId = authService.createOrgAdmin(request.getEmail(), request.getOrgId());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(Map.of("userId", userId.toString(), "message", "Org Admin created successfully"));
    }

    @Operation(summary = "Get all recruiters for an organization (Org Admin only)")
    @GetMapping("/auth/org/recruiters")
    public ResponseEntity<List<AuthUser>> getRecruiters(
            @RequestHeader(value = "X-Org-Id", required = false) String orgIdHeader) {
        if (orgIdHeader == null || orgIdHeader.isBlank()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        return ResponseEntity.ok(authService.getRecruiters(UUID.fromString(orgIdHeader)));
    }

    @Operation(summary = "Create a recruiter (Org Admin only)")
    @PostMapping("/auth/org/recruiters")
    public ResponseEntity<Map<String, Object>> createRecruiter(
            @Valid @RequestBody CreateRecruiterRequest request,
            @RequestHeader(value = "X-Org-Id", required = false) String orgIdHeader) {
        if (orgIdHeader == null || orgIdHeader.isBlank()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        UUID userId = authService.createRecruiter(request.getEmail(), request.getFirstName(), request.getLastName(), UUID.fromString(orgIdHeader));
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(Map.of("userId", userId.toString(), "message", "Recruiter created successfully"));
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
