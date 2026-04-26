package com.ats.user;

import com.ats.user.config.FileStorageConfig;
import com.ats.user.dto.BootstrapProfileRequest;
import com.ats.user.dto.ProfileResponse;
import com.ats.user.dto.ProfileUpdateRequest;
import com.ats.user.entity.UserProfile;
import com.ats.user.exception.ForbiddenException;
import com.ats.user.exception.ResourceNotFoundException;
import com.ats.user.repository.DocumentRepository;
import com.ats.user.repository.UserProfileRepository;
import com.ats.user.service.UserProfileService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UserProfileServiceTest {

    @Mock
    private UserProfileRepository userProfileRepository;

    @Mock
    private DocumentRepository documentRepository;

    @Mock
    private FileStorageConfig fileStorageConfig;

    @InjectMocks
    private UserProfileService userProfileService;

    private UUID profileId;
    private UUID authUserId;
    private UserProfile existingProfile;

    @BeforeEach
    void setUp() {
        profileId = UUID.randomUUID();
        authUserId = UUID.randomUUID();

        existingProfile = UserProfile.builder()
                .id(profileId)
                .authUserId(authUserId)
                .firstName("John")
                .lastName("Doe")
                .email("john.doe@example.com")
                .role("CANDIDATE")
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();
    }

    @Test
    @DisplayName("bootstrapProfile - should create a new profile successfully")
    void bootstrapProfile_success() {
        BootstrapProfileRequest request = BootstrapProfileRequest.builder()
                .authUserId(authUserId)
                .firstName("John")
                .lastName("Doe")
                .email("john.doe@example.com")
                .role("CANDIDATE")
                .build();

        when(userProfileRepository.existsByAuthUserId(authUserId)).thenReturn(false);
        when(userProfileRepository.save(any(UserProfile.class))).thenReturn(existingProfile);

        ProfileResponse response = userProfileService.bootstrapProfile(request);

        assertThat(response).isNotNull();
        assertThat(response.getFirstName()).isEqualTo("John");
        assertThat(response.getLastName()).isEqualTo("Doe");
        assertThat(response.getEmail()).isEqualTo("john.doe@example.com");
        assertThat(response.getAuthUserId()).isEqualTo(authUserId);
        verify(userProfileRepository).save(any(UserProfile.class));
    }

    @Test
    @DisplayName("bootstrapProfile - should throw when profile already exists")
    void bootstrapProfile_alreadyExists() {
        BootstrapProfileRequest request = BootstrapProfileRequest.builder()
                .authUserId(authUserId)
                .firstName("John")
                .lastName("Doe")
                .email("john.doe@example.com")
                .role("CANDIDATE")
                .build();

        when(userProfileRepository.existsByAuthUserId(authUserId)).thenReturn(true);

        assertThatThrownBy(() -> userProfileService.bootstrapProfile(request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Profile already exists");

        verify(userProfileRepository, never()).save(any());
    }

    @Test
    @DisplayName("getProfile - should return profile when found")
    void getProfile_found() {
        when(userProfileRepository.findById(profileId)).thenReturn(Optional.of(existingProfile));

        ProfileResponse response = userProfileService.getProfile(profileId);

        assertThat(response).isNotNull();
        assertThat(response.getId()).isEqualTo(profileId);
        assertThat(response.getFirstName()).isEqualTo("John");
    }

    @Test
    @DisplayName("getProfile - should throw ResourceNotFoundException when not found")
    void getProfile_notFound() {
        UUID unknownId = UUID.randomUUID();
        when(userProfileRepository.findById(unknownId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> userProfileService.getProfile(unknownId))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    @DisplayName("updateProfile - should update when user owns the profile")
    void updateProfile_ownershipMatch() {
        ProfileUpdateRequest updateRequest = ProfileUpdateRequest.builder()
                .firstName("Jane")
                .phone("+1234567890")
                .build();

        UserProfile updatedProfile = UserProfile.builder()
                .id(profileId)
                .authUserId(authUserId)
                .firstName("Jane")
                .lastName("Doe")
                .email("john.doe@example.com")
                .phone("+1234567890")
                .role("CANDIDATE")
                .createdAt(existingProfile.getCreatedAt())
                .updatedAt(LocalDateTime.now())
                .build();

        when(userProfileRepository.findById(profileId)).thenReturn(Optional.of(existingProfile));
        when(userProfileRepository.save(any(UserProfile.class))).thenReturn(updatedProfile);

        ProfileResponse response = userProfileService.updateProfile(
                profileId, updateRequest, authUserId.toString());

        assertThat(response).isNotNull();
        assertThat(response.getFirstName()).isEqualTo("Jane");
        assertThat(response.getPhone()).isEqualTo("+1234567890");
        verify(userProfileRepository).save(any(UserProfile.class));
    }

    @Test
    @DisplayName("updateProfile - should throw ForbiddenException when user does not own the profile")
    void updateProfile_ownershipMismatch() {
        UUID differentUserId = UUID.randomUUID();

        ProfileUpdateRequest updateRequest = ProfileUpdateRequest.builder()
                .firstName("Hacker")
                .build();

        when(userProfileRepository.findById(profileId)).thenReturn(Optional.of(existingProfile));

        assertThatThrownBy(() -> userProfileService.updateProfile(
                profileId, updateRequest, differentUserId.toString()))
                .isInstanceOf(ForbiddenException.class)
                .hasMessageContaining("not authorized");

        verify(userProfileRepository, never()).save(any());
    }
}
