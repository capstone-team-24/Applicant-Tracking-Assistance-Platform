package com.ats.auth.controller;

import com.ats.auth.dto.JwksResponse;
import com.ats.auth.dto.LoginRequest;
import com.ats.auth.dto.LoginResponse;
import com.ats.auth.dto.RefreshRequest;
import com.ats.auth.dto.RefreshResponse;
import com.ats.auth.dto.SignupRequest;
import com.ats.auth.service.AuthService;
import com.ats.auth.service.JwtService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

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
