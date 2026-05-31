package com.ats.auth.service;

import com.ats.auth.dto.LoginResponse;
import com.ats.auth.dto.RefreshResponse;
import com.ats.auth.dto.SignupRequest;
import com.ats.auth.entity.AuthUser;
import com.ats.auth.entity.RefreshToken;
import com.ats.auth.entity.Role;
import com.ats.auth.exception.DuplicateEmailException;
import com.ats.auth.exception.InvalidCredentialsException;
import com.ats.auth.feign.JobServiceClient;
import com.ats.auth.feign.NotificationServiceClient;
import com.ats.auth.feign.UserServiceClient;
import com.ats.auth.repository.AuthUserRepository;
import com.ats.auth.repository.InviteTokenRepository;
import com.ats.auth.repository.RefreshTokenRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private AuthUserRepository authUserRepository;

    @Mock
    private RefreshTokenRepository refreshTokenRepository;

    @Mock
    private InviteTokenRepository inviteTokenRepository;

    @Mock
    private JwtService jwtService;

    @Mock
    private UserServiceClient userServiceClient;

    @Mock
    private NotificationServiceClient notificationServiceClient;

    @Mock
    private JobServiceClient jobServiceClient;

    private AuthService authService;

    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    @BeforeEach
    void setUp() {
        authService = new AuthService(authUserRepository, refreshTokenRepository, inviteTokenRepository, jwtService, userServiceClient, notificationServiceClient, jobServiceClient);
    }

    @Test
    void signup_success() {
        SignupRequest request = SignupRequest.builder()
                .firstName("John")
                .lastName("Doe")
                .email("john@example.com")
                .password("password123")
                .role(Role.CANDIDATE)
                .build();

        when(authUserRepository.findByEmail("john@example.com")).thenReturn(Optional.empty());
        when(authUserRepository.save(any(AuthUser.class))).thenAnswer(invocation -> {
            AuthUser user = invocation.getArgument(0);
            user.setId(UUID.randomUUID());
            return user;
        });

        UUID userId = authService.signup(request);

        assertNotNull(userId);
        verify(authUserRepository).save(any(AuthUser.class));
        verify(userServiceClient).bootstrapProfile(any());
    }

    @Test
    void signup_duplicateEmail_throwsException() {
        SignupRequest request = SignupRequest.builder()
                .firstName("John")
                .lastName("Doe")
                .email("john@example.com")
                .password("password123")
                .role(Role.CANDIDATE)
                .build();

        when(authUserRepository.findByEmail("john@example.com"))
                .thenReturn(Optional.of(new AuthUser()));

        assertThrows(DuplicateEmailException.class, () -> authService.signup(request));

        verify(authUserRepository, never()).save(any(AuthUser.class));
    }

    @Test
    void login_wrongPassword_throwsException() {
        String email = "john@example.com";
        String wrongPassword = "wrongpassword";

        AuthUser user = AuthUser.builder()
                .id(UUID.randomUUID())
                .email(email)
                .passwordHash(passwordEncoder.encode("correctpassword"))
                .firstName("John")
                .lastName("Doe")
                .role(Role.CANDIDATE)
                .build();

        when(authUserRepository.findByEmail(email)).thenReturn(Optional.of(user));

        assertThrows(InvalidCredentialsException.class, () -> authService.login(email, wrongPassword));
    }

    @Test
    void login_success_returnsTokens() {
        String email = "john@example.com";
        String password = "password123";
        UUID userId = UUID.randomUUID();

        AuthUser user = AuthUser.builder()
                .id(userId)
                .email(email)
                .passwordHash(passwordEncoder.encode(password))
                .firstName("John")
                .lastName("Doe")
                .role(Role.CANDIDATE)
                .build();

        when(authUserRepository.findByEmail(email)).thenReturn(Optional.of(user));
        when(jwtService.generateAccessToken(user)).thenReturn("mock-access-token");
        when(jwtService.getRefreshTtlDays()).thenReturn(7L);
        when(jwtService.getAccessTtlSeconds()).thenReturn(900L);
        when(refreshTokenRepository.save(any(RefreshToken.class))).thenAnswer(i -> i.getArgument(0));

        LoginResponse response = authService.login(email, password);

        assertNotNull(response);
        assertEquals("mock-access-token", response.getAccessToken());
        assertNotNull(response.getRefreshToken());
        assertEquals(900L, response.getExpiresIn());
        assertEquals(userId, response.getUserId());
        assertEquals(Role.CANDIDATE, response.getRole());
    }

    @Test
    void refresh_validToken_rotatesTokens() {
        String oldRawToken = "old-refresh-token";
        UUID userId = UUID.randomUUID();

        RefreshToken storedToken = RefreshToken.builder()
                .id(UUID.randomUUID())
                .userId(userId)
                .tokenHash(sha256(oldRawToken))
                .expiresAt(LocalDateTime.now().plusDays(7))
                .revoked(false)
                .build();

        AuthUser user = AuthUser.builder()
                .id(userId)
                .email("john@example.com")
                .passwordHash("hashed")
                .firstName("John")
                .lastName("Doe")
                .role(Role.CANDIDATE)
                .build();

        when(refreshTokenRepository.findByTokenHashAndRevokedFalse(anyString()))
                .thenReturn(Optional.of(storedToken));
        when(authUserRepository.findById(userId)).thenReturn(Optional.of(user));
        when(jwtService.generateAccessToken(user)).thenReturn("new-access-token");
        when(jwtService.getRefreshTtlDays()).thenReturn(7L);
        when(jwtService.getAccessTtlSeconds()).thenReturn(900L);
        when(refreshTokenRepository.save(any(RefreshToken.class))).thenAnswer(i -> i.getArgument(0));

        RefreshResponse response = authService.refresh(oldRawToken);

        assertNotNull(response);
        assertEquals("new-access-token", response.getAccessToken());
        assertNotNull(response.getRefreshToken());
        assertNotEquals(oldRawToken, response.getRefreshToken());

        ArgumentCaptor<RefreshToken> captor = ArgumentCaptor.forClass(RefreshToken.class);
        verify(refreshTokenRepository, org.mockito.Mockito.atLeast(2)).save(captor.capture());
    }

    private String sha256(String input) {
        try {
            java.security.MessageDigest digest = java.security.MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(input.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            return java.util.HexFormat.of().formatHex(hash);
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new RuntimeException(e);
        }
    }
}
