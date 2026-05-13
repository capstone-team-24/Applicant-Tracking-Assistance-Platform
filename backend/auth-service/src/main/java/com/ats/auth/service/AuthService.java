package com.ats.auth.service;

import com.ats.auth.dto.AcceptInviteRequest;
import com.ats.auth.dto.BootstrapProfileRequest;
import com.ats.auth.dto.InviteTokenResponse;
import com.ats.auth.dto.LoginResponse;
import com.ats.auth.dto.RefreshResponse;
import com.ats.auth.dto.SignupRequest;
import com.ats.auth.entity.AuthUser;
import com.ats.auth.entity.InviteToken;
import com.ats.auth.entity.RefreshToken;
import com.ats.auth.entity.Role;
import com.ats.auth.exception.DuplicateEmailException;
import com.ats.auth.exception.InvalidCredentialsException;
import com.ats.auth.exception.InvalidTokenException;
import com.ats.auth.feign.JobServiceClient;
import com.ats.auth.feign.NotificationServiceClient;
import com.ats.auth.feign.UserServiceClient;
import com.ats.auth.repository.AuthUserRepository;
import com.ats.auth.repository.InviteTokenRepository;
import com.ats.auth.repository.RefreshTokenRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
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
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final AuthUserRepository authUserRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final InviteTokenRepository inviteTokenRepository;
    private final JwtService jwtService;
    private final UserServiceClient userServiceClient;
    private final NotificationServiceClient notificationServiceClient;
    private final JobServiceClient jobServiceClient;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();
    private final SecureRandom secureRandom = new SecureRandom();

    @Value("${app.frontend-base-url:http://localhost:3000}")
    private String frontendBaseUrl;

    // ──────────────────────────────────────────────────────────────
    //  Candidate self-signup
    // ──────────────────────────────────────────────────────────────

    @Transactional
    public UUID signup(SignupRequest request) {
        if (authUserRepository.findByEmail(request.getEmail()).isPresent()) {
            throw new DuplicateEmailException(request.getEmail());
        }

        if (request.getRole() == Role.RECRUITER) {
            throw new IllegalArgumentException("Recruiter signup is not allowed publicly. Must be invited by an Organization Admin.");
        }

        UUID orgId = request.getOrgId();

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

    // ──────────────────────────────────────────────────────────────
    //  Invite: Org Admin (Platform Admin action)
    // ──────────────────────────────────────────────────────────────

    @Transactional
    public void inviteOrgAdmin(String email, UUID orgId) {
        if (authUserRepository.findByEmail(email).isPresent()) {
            throw new DuplicateEmailException(email);
        }

        InviteToken invite = InviteToken.builder()
                .email(email)
                .role(Role.ORG_ADMIN)
                .orgId(orgId)
                .expiresAt(LocalDateTime.now().plusHours(72))
                .build();

        inviteTokenRepository.save(invite);

        String setupLink = frontendBaseUrl + "/invite/setup?token=" + invite.getToken();

        try {
            notificationServiceClient.sendNotification(com.ats.auth.dto.SendNotificationRequest.builder()
                    .recipientEmail(email)
                    .subject("You've been invited to join as an Organization Admin")
                    .body(buildInviteEmail(
                            "Organization Admin Invitation",
                            "You have been invited to join the platform as an <strong>Organization Admin</strong>.",
                            "Click the button below to set up your name and password and activate your account.",
                            "Set Up My Account",
                            setupLink,
                            "This secure link expires in <strong>72 hours</strong>. If you did not expect this invitation, you can safely ignore this email."
                    ))
                    .type("EMAIL")
                    .build());
        } catch (Exception e) {
            log.warn("Failed to send org admin invite email to {}: {}", email, e.getMessage());
        }

        log.info("Org Admin invite created: token={}, email={}, orgId={}", invite.getToken(), email, orgId);
    }

    // ──────────────────────────────────────────────────────────────
    //  Invite: Recruiter (Org Admin action)
    // ──────────────────────────────────────────────────────────────

    @Transactional
    public void inviteRecruiter(String email, String firstName, String lastName, UUID orgId) {
        if (authUserRepository.findByEmail(email).isPresent()) {
            throw new DuplicateEmailException(email);
        }

        InviteToken invite = InviteToken.builder()
                .email(email)
                .role(Role.RECRUITER)
                .orgId(orgId)
                .firstName(firstName)
                .lastName(lastName)
                .expiresAt(LocalDateTime.now().plusHours(72))
                .build();

        inviteTokenRepository.save(invite);

        String setupLink = frontendBaseUrl + "/invite/setup?token=" + invite.getToken();

        try {
            notificationServiceClient.sendNotification(com.ats.auth.dto.SendNotificationRequest.builder()
                    .recipientEmail(email)
                    .subject("You've been invited to join as a Recruiter")
                    .body(buildInviteEmail(
                            "Recruiter Invitation",
                            "Hi <strong>" + firstName + "</strong>, you have been invited to join the platform as a <strong>Recruiter</strong>.",
                            "Click the button below to confirm your details and choose a password to activate your account.",
                            "Set Up My Account",
                            setupLink,
                            "This secure link expires in <strong>72 hours</strong>. If you did not expect this invitation, you can safely ignore this email."
                    ))
                    .type("EMAIL")
                    .build());
        } catch (Exception e) {
            log.warn("Failed to send recruiter invite email to {}: {}", email, e.getMessage());
        }

        log.info("Recruiter invite created: token={}, email={}, orgId={}", invite.getToken(), email, orgId);
    }

    // ──────────────────────────────────────────────────────────────
    //  Validate invite token (public – called by setup page on load)
    // ──────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public InviteTokenResponse validateInviteToken(UUID token) {
        InviteToken invite = inviteTokenRepository.findByToken(token)
                .orElseThrow(() -> new InvalidTokenException("Invite link is invalid or does not exist."));

        if (Boolean.TRUE.equals(invite.getUsed())) {
            throw new InvalidTokenException("This invite link has already been used.");
        }

        if (invite.getExpiresAt().isBefore(LocalDateTime.now())) {
            throw new InvalidTokenException("This invite link has expired.");
        }

        return InviteTokenResponse.builder()
                .token(invite.getToken())
                .email(invite.getEmail())
                .role(invite.getRole())
                .orgId(invite.getOrgId())
                .firstName(invite.getFirstName())
                .lastName(invite.getLastName())
                .expiresAt(invite.getExpiresAt())
                .build();
    }

    // ──────────────────────────────────────────────────────────────
    //  Accept invite – creates the account
    // ──────────────────────────────────────────────────────────────

    @Transactional
    public UUID acceptInvite(AcceptInviteRequest request) {
        InviteToken invite = inviteTokenRepository.findByToken(request.getToken())
                .orElseThrow(() -> new InvalidTokenException("Invite link is invalid or does not exist."));

        if (Boolean.TRUE.equals(invite.getUsed())) {
            throw new InvalidTokenException("This invite link has already been used.");
        }

        if (invite.getExpiresAt().isBefore(LocalDateTime.now())) {
            throw new InvalidTokenException("This invite link has expired.");
        }

        if (authUserRepository.findByEmail(invite.getEmail()).isPresent()) {
            throw new DuplicateEmailException(invite.getEmail());
        }

        AuthUser user = AuthUser.builder()
                .email(invite.getEmail())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .firstName(request.getFirstName())
                .lastName(request.getLastName())
                .role(invite.getRole())
                .orgId(invite.getOrgId())
                .build();

        AuthUser saved = authUserRepository.save(user);

        // Mark invite as used
        invite.setUsed(true);
        inviteTokenRepository.save(invite);

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
            log.warn("Failed to bootstrap profile for userId={}: {}", saved.getId(), e.getMessage());
        }

        log.info("Account created via invite: userId={}, email={}, role={}", saved.getId(), saved.getEmail(), saved.getRole());
        return saved.getId();
    }

    // ──────────────────────────────────────────────────────────────
    //  Recruiters – list / suspend
    // ──────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<AuthUser> getRecruiters(UUID orgId) {
        return authUserRepository.findByOrgIdAndRole(orgId, Role.RECRUITER);
    }

    @Transactional
    public void suspendRecruiter(UUID recruiterId, UUID orgId, boolean suspend) {
        AuthUser recruiter = authUserRepository.findById(recruiterId)
                .orElseThrow(() -> new IllegalArgumentException("Recruiter not found"));

        if (!recruiter.getOrgId().equals(orgId)) {
            throw new IllegalArgumentException("Recruiter does not belong to your organization");
        }

        if (recruiter.getRole() != Role.RECRUITER) {
            throw new IllegalArgumentException("User is not a recruiter");
        }

        recruiter.setIsSuspended(suspend);
        authUserRepository.save(recruiter);

        try {
            jobServiceClient.suspendJobsByRecruiter(recruiterId, suspend);
        } catch (Exception e) {
            log.error("Failed to notify jobs-service of recruiter suspension: {}", e.getMessage());
        }
    }

    // ──────────────────────────────────────────────────────────────
    //  Auth – login / refresh / logout
    // ──────────────────────────────────────────────────────────────

    @Transactional
    public LoginResponse login(String email, String password) {
        AuthUser user = authUserRepository.findByEmail(email)
                .orElseThrow(InvalidCredentialsException::new);

        if (Boolean.TRUE.equals(user.getIsSuspended())) {
            throw new InvalidCredentialsException();
        }

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

    // ──────────────────────────────────────────────────────────────
    //  Helpers
    // ──────────────────────────────────────────────────────────────

    private String generateOpaqueToken() {
        byte[] bytes = new byte[32];
        secureRandom.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    /**
     * Builds a branded HTML invite email.
     */
    private String buildInviteEmail(String title, String intro, String instruction,
                                    String buttonText, String buttonUrl, String footer) {
        return "<!DOCTYPE html>"
                + "<html lang='en'><head><meta charset='UTF-8'>"
                + "<meta name='viewport' content='width=device-width,initial-scale=1'></head>"
                + "<body style='margin:0;padding:0;background:#0f0f1a;font-family:Inter,Segoe UI,Arial,sans-serif;'>"

                // ── Outer wrapper
                + "<table width='100%' cellpadding='0' cellspacing='0' style='background:#0f0f1a;padding:40px 16px;'>"
                + "<tr><td align='center'>"

                // ── Card
                + "<table width='560' cellpadding='0' cellspacing='0' style='max-width:560px;width:100%;background:#1e1e30;"
                + "border-radius:16px;overflow:hidden;border:1px solid #2e2e50;'>"

                // ── Header bar
                + "<tr><td style='background:linear-gradient(135deg,#7c3aed,#6d28d9);padding:32px 40px;text-align:center;'>"
                + "<p style='margin:0 0 6px 0;font-size:11px;font-weight:600;letter-spacing:2px;"
                + "text-transform:uppercase;color:#c4b5fd;'>Recruitment Platform</p>"
                + "<h1 style='margin:0;font-size:24px;font-weight:700;color:#ffffff;'>"
                + title + "</h1>"
                + "</td></tr>"

                // ── Body
                + "<tr><td style='padding:36px 40px;'>"
                + "<p style='margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#cbd5e1;'>" + intro + "</p>"
                + "<p style='margin:0 0 28px 0;font-size:15px;line-height:1.6;color:#94a3b8;'>" + instruction + "</p>"

                // ── CTA button
                + "<table cellpadding='0' cellspacing='0' style='margin:0 auto 32px auto;'>"
                + "<tr><td align='center' style='background:linear-gradient(135deg,#7c3aed,#6d28d9);"
                + "border-radius:10px;'>"
                + "<a href='" + buttonUrl + "' target='_blank' "
                + "style='display:inline-block;padding:14px 36px;font-size:15px;font-weight:600;"
                + "color:#ffffff;text-decoration:none;letter-spacing:0.3px;'>" + buttonText + "</a>"
                + "</td></tr></table>"

                // ── Fallback link
                + "<p style='margin:0 0 8px 0;font-size:12px;color:#64748b;'>If the button does not work, copy and paste this link into your browser:</p>"
                + "<p style='margin:0;font-size=12px;word-break:break-all;'>"
                + "<a href='" + buttonUrl + "' style='color:#a78bfa;text-decoration:underline;font-size:12px;'>" + buttonUrl + "</a></p>"
                + "</td></tr>"

                // ── Footer
                + "<tr><td style='padding:20px 40px 28px;border-top:1px solid #2e2e50;text-align:center;'>"
                + "<p style='margin:0 0 6px 0;font-size:12px;line-height:1.6;color:#475569;'>" + footer + "</p>"
                + "<p style='margin:0;font-size:11px;color:#334155;'>&#169; ATS Recruitment Platform</p>"
                + "</td></tr>"

                + "</table>" // end card
                + "</td></tr></table>" // end outer
                + "</body></html>";
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
