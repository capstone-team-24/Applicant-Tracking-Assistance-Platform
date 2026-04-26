package com.ats.auth.service;

import com.ats.auth.dto.BootstrapProfileRequest;
import com.ats.auth.dto.LoginResponse;
import com.ats.auth.dto.RefreshResponse;
import com.ats.auth.dto.SignupRequest;
import com.ats.auth.entity.AuthUser;
import com.ats.auth.entity.RefreshToken;
import com.ats.auth.entity.Role;
import com.ats.auth.exception.DuplicateEmailException;
import com.ats.auth.exception.InvalidCredentialsException;
import com.ats.auth.exception.InvalidTokenException;
import com.ats.auth.feign.UserServiceClient;
import com.ats.auth.repository.AuthUserRepository;
import com.ats.auth.repository.RefreshTokenRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.HexFormat;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final AuthUserRepository authUserRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final JwtService jwtService;
    private final UserServiceClient userServiceClient;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();
    private final SecureRandom secureRandom = new SecureRandom();

    @Transactional
    public UUID signup(SignupRequest request) {
        if (authUserRepository.findByEmail(request.getEmail()).isPresent()) {
            throw new DuplicateEmailException(request.getEmail());
        }

        // Auto-generate an orgId for RECRUITER users if not provided
        UUID orgId = request.getOrgId();
        if (orgId == null && request.getRole() == Role.RECRUITER) {
            orgId = UUID.randomUUID();
        }

        AuthUser user = AuthUser.builder()
                .email(request.getEmail())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .firstName(request.getFirstName())
                .lastName(request.getLastName())
                .role(request.getRole())
                .orgId(orgId)
                .build();

        AuthUser saved = authUserRepository.save(user);

        try {
            userServiceClient.bootstrapProfile(BootstrapProfileRequest.builder()
                    .authUserId(saved.getId())
                    .firstName(saved.getFirstName())
                    .lastName(saved.getLastName())
                    .email(saved.getEmail())
                    .role(saved.getRole())
                    .orgId(saved.getOrgId())
                    .build());
        } catch (Exception e) {
            log.warn("Failed to bootstrap user profile for userId={}: {}", saved.getId(), e.getMessage());
        }

        log.info("User signed up successfully: userId={}, email={}", saved.getId(), saved.getEmail());
        return saved.getId();
    }

    @Transactional
    public LoginResponse login(String email, String password) {
        AuthUser user = authUserRepository.findByEmail(email)
                .orElseThrow(InvalidCredentialsException::new);

        if (!passwordEncoder.matches(password, user.getPasswordHash())) {
            throw new InvalidCredentialsException();
        }

        String accessToken = jwtService.generateAccessToken(user);
        String rawRefreshToken = generateOpaqueToken();
        String tokenHash = sha256(rawRefreshToken);

        RefreshToken refreshToken = RefreshToken.builder()
                .id(UUID.randomUUID())
                .userId(user.getId())
                .tokenHash(tokenHash)
                .expiresAt(LocalDateTime.now().plusDays(jwtService.getRefreshTtlDays()))
                .build();

        refreshTokenRepository.save(refreshToken);

        log.info("User logged in: userId={}", user.getId());

        return LoginResponse.builder()
                .accessToken(accessToken)
                .refreshToken(rawRefreshToken)
                .expiresIn(jwtService.getAccessTtlSeconds())
                .userId(user.getId())
                .role(user.getRole())
                .orgId(user.getOrgId())
                .email(user.getEmail())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .build();
    }

    @Transactional
    public RefreshResponse refresh(String rawRefreshToken) {
        String tokenHash = sha256(rawRefreshToken);

        RefreshToken storedToken = refreshTokenRepository.findByTokenHashAndRevokedFalse(tokenHash)
                .orElseThrow(() -> new InvalidTokenException("Invalid or revoked refresh token"));

        if (storedToken.getExpiresAt().isBefore(LocalDateTime.now())) {
            storedToken.setRevoked(true);
            refreshTokenRepository.save(storedToken);
            throw new InvalidTokenException("Refresh token has expired");
        }

        storedToken.setRevoked(true);
        refreshTokenRepository.save(storedToken);

        AuthUser user = authUserRepository.findById(storedToken.getUserId())
                .orElseThrow(() -> new InvalidTokenException("User not found for refresh token"));

        String newAccessToken = jwtService.generateAccessToken(user);
        String newRawRefreshToken = generateOpaqueToken();
        String newTokenHash = sha256(newRawRefreshToken);

        RefreshToken newRefreshToken = RefreshToken.builder()
                .id(UUID.randomUUID())
                .userId(user.getId())
                .tokenHash(newTokenHash)
                .expiresAt(LocalDateTime.now().plusDays(jwtService.getRefreshTtlDays()))
                .build();

        refreshTokenRepository.save(newRefreshToken);

        log.info("Token refreshed for userId={}", user.getId());

        return RefreshResponse.builder()
                .accessToken(newAccessToken)
                .refreshToken(newRawRefreshToken)
                .expiresIn(jwtService.getAccessTtlSeconds())
                .build();
    }

    @Transactional
    public void logout(String rawRefreshToken) {
        String tokenHash = sha256(rawRefreshToken);
        refreshTokenRepository.findByTokenHashAndRevokedFalse(tokenHash)
                .ifPresent(token -> {
                    token.setRevoked(true);
                    refreshTokenRepository.save(token);
                    log.info("Refresh token revoked for userId={}", token.getUserId());
                });
    }

    private String generateOpaqueToken() {
        byte[] bytes = new byte[32];
        secureRandom.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String sha256(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 algorithm not available", e);
        }
    }
}
