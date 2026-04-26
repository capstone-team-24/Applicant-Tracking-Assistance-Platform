package com.ats.user.service;

import com.ats.user.config.FileStorageConfig;
import com.ats.user.dto.*;
import com.ats.user.entity.Document;
import com.ats.user.entity.UserProfile;
import com.ats.user.exception.ForbiddenException;
import com.ats.user.exception.ResourceNotFoundException;
import com.ats.user.repository.DocumentRepository;
import com.ats.user.repository.UserProfileRepository;
import com.ats.user.util.FileUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class UserProfileService {

    private final UserProfileRepository userProfileRepository;
    private final DocumentRepository documentRepository;
    private final FileStorageConfig fileStorageConfig;

    @Transactional
    public ProfileResponse bootstrapProfile(BootstrapProfileRequest request) {
        if (userProfileRepository.existsByAuthUserId(request.getAuthUserId())) {
            throw new IllegalArgumentException(
                    "Profile already exists for authUserId: " + request.getAuthUserId());
        }

        UserProfile profile = UserProfile.builder()
                .authUserId(request.getAuthUserId())
                .firstName(request.getFirstName())
                .lastName(request.getLastName())
                .email(request.getEmail())
                .role(request.getRole())
                .orgId(request.getOrgId())
                .build();

        UserProfile saved = userProfileRepository.save(profile);
        log.info("Bootstrapped profile for authUserId={}", request.getAuthUserId());
        return toProfileResponse(saved);
    }

    @Transactional(readOnly = true)
    public ProfileResponse getProfile(UUID id) {
        UserProfile profile = userProfileRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("UserProfile", "id", id));
        return toProfileResponse(profile);
    }

    @Transactional(readOnly = true)
    public ProfileResponse getProfileByAuthUserId(UUID authUserId) {
        UserProfile profile = userProfileRepository.findByAuthUserId(authUserId)
                .orElseThrow(() -> new ResourceNotFoundException("UserProfile", "authUserId", authUserId));
        return toProfileResponse(profile);
    }

    @Transactional
    public ProfileResponse updateProfile(UUID id, ProfileUpdateRequest request, String requestingUserId) {
        UserProfile profile = userProfileRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("UserProfile", "id", id));

        // Ownership check: the requesting user must own this profile
        if (!profile.getAuthUserId().toString().equals(requestingUserId)) {
            throw new ForbiddenException("You are not authorized to update this profile");
        }

        if (request.getFirstName() != null) {
            profile.setFirstName(request.getFirstName());
        }
        if (request.getLastName() != null) {
            profile.setLastName(request.getLastName());
        }
        if (request.getPhone() != null) {
            profile.setPhone(request.getPhone());
        }
        if (request.getBio() != null) {
            profile.setBio(request.getBio());
        }
        if (request.getYearsOfExperience() != null) {
            profile.setYearsOfExperience(request.getYearsOfExperience());
        }

        UserProfile saved = userProfileRepository.save(profile);
        log.info("Updated profile id={}", id);
        return toProfileResponse(saved);
    }

    @Transactional(readOnly = true)
    public ApplicationDataResponse getApplicationData(UUID authUserId) {
        UserProfile profile = userProfileRepository.findByAuthUserId(authUserId)
                .orElseThrow(() -> new ResourceNotFoundException("UserProfile", "authUserId", authUserId));

        return ApplicationDataResponse.builder()
                .firstName(profile.getFirstName())
                .lastName(profile.getLastName())
                .email(profile.getEmail())
                .phone(profile.getPhone())
                .latestCvUrl(profile.getCvUrl())
                .yearsOfExperience(profile.getYearsOfExperience())
                .build();
    }

    @Transactional
    public ProfileResponse uploadCv(UUID profileId, MultipartFile file, String orgId) {
        UserProfile profile = userProfileRepository.findById(profileId)
                .orElseThrow(() -> new ResourceNotFoundException("UserProfile", "id", profileId));

        // Validate file
        if (file.isEmpty()) {
            throw new IllegalArgumentException("Uploaded file is empty");
        }

        String contentType = file.getContentType();
        if (!FileUtils.isAllowedContentType(contentType)) {
            throw new IllegalArgumentException("File type not allowed: " + contentType);
        }

        String originalFilename = file.getOriginalFilename();
        String sanitizedFilename = FileUtils.sanitizeFilename(originalFilename);

        if (!FileUtils.isAllowedExtension(sanitizedFilename)) {
            throw new IllegalArgumentException("File extension not allowed");
        }

        // Build storage path: {basePath}/{orgId}/profiles/{profileId}/{filename}
        String effectiveOrgId = orgId != null ? orgId : "default";
        Path storagePath = Paths.get(fileStorageConfig.getBasePath(),
                effectiveOrgId, "profiles", profileId.toString());

        try {
            Files.createDirectories(storagePath);
            Path filePath = storagePath.resolve(sanitizedFilename);
            Files.copy(file.getInputStream(), filePath, StandardCopyOption.REPLACE_EXISTING);

            // Create document record
            Document document = Document.builder()
                    .profileId(profileId)
                    .filename(sanitizedFilename)
                    .path(filePath.toString())
                    .contentType(contentType)
                    .fileSize(file.getSize())
                    .build();
            documentRepository.save(document);

            // Update profile CV URL
            profile.setCvUrl(filePath.toString());
            UserProfile saved = userProfileRepository.save(profile);
            log.info("Uploaded CV for profileId={}, file={}", profileId, sanitizedFilename);
            return toProfileResponse(saved);
        } catch (IOException e) {
            log.error("Failed to store file for profileId={}", profileId, e);
            throw new RuntimeException("Failed to store file: " + e.getMessage(), e);
        }
    }

    private ProfileResponse toProfileResponse(UserProfile profile) {
        return ProfileResponse.builder()
                .id(profile.getId())
                .authUserId(profile.getAuthUserId())
                .firstName(profile.getFirstName())
                .lastName(profile.getLastName())
                .email(profile.getEmail())
                .phone(profile.getPhone())
                .bio(profile.getBio())
                .cvUrl(profile.getCvUrl())
                .role(profile.getRole())
                .orgId(profile.getOrgId())
                .yearsOfExperience(profile.getYearsOfExperience())
                .createdAt(profile.getCreatedAt())
                .updatedAt(profile.getUpdatedAt())
                .build();
    }
}
