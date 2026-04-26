package com.ats.jobs.service;

import com.ats.jobs.config.KafkaConfig;
import com.ats.jobs.dto.*;
import com.ats.jobs.entity.Application;
import com.ats.jobs.entity.Job;
import com.ats.jobs.enums.ApplicationStatus;
import com.ats.jobs.enums.JobStatus;
import com.ats.jobs.exception.BadRequestException;
import com.ats.jobs.exception.ResourceNotFoundException;
import com.ats.jobs.feign.UserServiceClient;
import com.ats.jobs.repository.ApplicationRepository;
import com.ats.jobs.repository.JobRepository;
import com.ats.jobs.util.FileStorageUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class ApplicationService {

    private final ApplicationRepository applicationRepository;
    private final JobRepository jobRepository;
    private final UserServiceClient userServiceClient;
    private final FileStorageUtil fileStorageUtil;
    private final KafkaTemplate<String, Object> kafkaTemplate;

    @Transactional
    public ApplicationResponse apply(UUID jobId, ApplyRequest request, MultipartFile file, UUID orgId, UUID candidateAuthUserId) {
        // 1. Validate job exists and is PUBLISHED
        Job job = jobRepository.findById(jobId)
                .orElseThrow(() -> new ResourceNotFoundException("Job not found with id: " + jobId));

        if (job.getStatus() != JobStatus.PUBLISHED) {
            throw new BadRequestException("Applications can only be submitted for PUBLISHED jobs. Current status: " + job.getStatus());
        }

        UUID effectiveOrgId = orgId != null ? orgId : job.getOrgId();

        // Use the authenticated user's ID from the header; fall back to request body if header is absent
        UUID effectiveCandidateId = candidateAuthUserId != null ? candidateAuthUserId : request.getCandidateAuthUserId();

        // Pre-generate the application ID for file naming
        UUID applicationId = UUID.randomUUID();

        // 2. If useProfileData and candidateAuthUserId present, fetch profile from user-service
        Map<String, Object> profileSnapshot = null;
        String candidateName = null;
        String candidateEmail = null;
        ApplicationDataResponse profileData = null;

        if (request.isUseProfileData() && effectiveCandidateId != null) {
            try {
                profileData = userServiceClient.getApplicationData(
                        effectiveCandidateId);
                if (profileData != null) {
                    profileSnapshot = new HashMap<>();
                    profileSnapshot.put("fullName", profileData.getFullName());
                    profileSnapshot.put("email", profileData.getEmail());
                    profileSnapshot.put("phone", profileData.getPhone());
                    profileSnapshot.put("latestCvUrl", profileData.getLatestCvUrl());
                    profileSnapshot.put("yearsOfExperience", profileData.getYearsOfExperience());
                    candidateName = profileData.getFullName();
                    candidateEmail = profileData.getEmail();
                }
            } catch (Exception e) {
                log.warn("Failed to fetch profile data for user {}: {}",
                        effectiveCandidateId, e.getMessage());
            }
        }

        // 3. Store file — prefer explicitly uploaded file; fall back to profile CV
        String filePath = null;
        String originalFilename = null;
        if (file != null && !file.isEmpty()) {
            try {
                filePath = fileStorageUtil.storeFile(file, effectiveOrgId, applicationId);
                originalFilename = file.getOriginalFilename();
            } catch (IOException e) {
                log.error("Failed to store file for application {}: {}", applicationId, e.getMessage());
                throw new BadRequestException("Failed to store uploaded file: " + e.getMessage());
            }
        } else if (request.isUseProfileData() && profileData != null && profileData.getLatestCvUrl() != null) {
            // Copy the profile's CV to the application storage directory
            try {
                Path sourcePath = Paths.get(profileData.getLatestCvUrl());
                if (Files.exists(sourcePath)) {
                    String sourceFilename = sourcePath.getFileName().toString();
                    // Strip any leading UUID from the profile filename to get a clean name
                    String cleanName = sourceFilename.replaceFirst("^[0-9a-f-]{36}_?", "");
                    if (cleanName.isBlank()) cleanName = sourceFilename;

                    Path directory = Paths.get(fileStorageUtil.getFilePath(profileData.getLatestCvUrl())
                            .getParent().toString().replace(
                                    sourcePath.getParent().toString(), ""
                            ));

                    // Build the target directory the same way storeFile does
                    Path targetDir = Paths.get(fileStorageUtil.getFilePath("").toString(),
                            effectiveOrgId.toString(), "applications");

                    // Simpler: just copy file side-by-side with a new name
                    String storedName = applicationId.toString() + "_" + cleanName;
                    Path appDir = sourcePath.getParent().getParent().getParent()
                            .resolve(effectiveOrgId.toString()).resolve("applications");
                    Files.createDirectories(appDir);
                    Path targetPath = appDir.resolve(storedName);
                    Files.copy(sourcePath, targetPath, StandardCopyOption.REPLACE_EXISTING);
                    filePath = targetPath.toString();
                    originalFilename = cleanName;
                    log.info("Copied profile CV to application {}: {}", applicationId, filePath);
                } else {
                    log.warn("Profile CV path does not exist on disk: {}", profileData.getLatestCvUrl());
                }
            } catch (Exception e) {
                log.warn("Could not copy profile CV for application {}: {}", applicationId, e.getMessage());
            }
        }

        // 4. Persist application
        Application application = Application.builder()
                .id(applicationId)
                .jobId(jobId)
                .candidateAuthUserId(effectiveCandidateId)
                .candidateName(candidateName)
                .candidateEmail(candidateEmail)
                .coverLetter(request.getCoverLetter())
                .portfolioLinks(request.getPortfolioLinks())
                .contactPhone(request.getContactPhone())
                .candidateProfileSnapshot(profileSnapshot)
                .originalFilePath(filePath)
                .originalFilename(originalFilename)
                .status(ApplicationStatus.APPLIED)
                .build();

        Application saved = applicationRepository.save(application);
        log.info("Application created id={} for jobId={}", saved.getId(), jobId);

        // 5. Emit Kafka event
        ApplicationSubmittedEvent event = ApplicationSubmittedEvent.builder()
                .applicationId(saved.getId())
                .jobId(jobId)
                .candidateAuthUserId(effectiveCandidateId)
                .filePath(filePath)
                .createdAt(LocalDateTime.now())
                .build();

        try {
            kafkaTemplate.send(
                    KafkaConfig.APPLICATION_SUBMITTED_TOPIC,
                    event);
            log.info("Published application.submitted event for applicationId={}", saved.getId());
        } catch (Exception e) {
            log.error("Failed to publish application.submitted event: {}", e.getMessage());
        }

        // 6. Return response
        return ApplicationResponse.builder()
                .id(saved.getId())
                .jobId(saved.getJobId())
                .candidateName(saved.getCandidateName())
                .candidateEmail(saved.getCandidateEmail())
                .status(saved.getStatus())
                .createdAt(saved.getCreatedAt())
                .compositeScore(saved.getCompositeScore())
                .rankingPosition(saved.getRankingPosition())
                .build();
    }

    @Transactional(readOnly = true)
    public ApplicationDetailResponse getApplication(UUID id) {
        Application app = findApplicationOrThrow(id);
        return mapToDetailResponse(app);
    }

    @Transactional(readOnly = true)
    public Page<ApplicationResponse> listApplications(UUID jobId, ApplicationStatus status, Pageable pageable) {
        Page<Application> page;
        if (status != null) {
            // Use findByJobId and filter, or create a custom query
            page = applicationRepository.findByJobId(jobId, pageable);
            // Filter in-memory for status (or add a new repo method)
            // Better approach: add repo method
        } else {
            page = applicationRepository.findByJobId(jobId, pageable);
        }

        if (status != null) {
            // We'll filter and re-page; for a production app we'd add findByJobIdAndStatus(Pageable)
            return applicationRepository.findByJobId(jobId, pageable)
                    .map(app -> {
                        if (app.getStatus() == status) {
                            return mapToResponse(app);
                        }
                        return null;
                    });
        }

        return page.map(this::mapToResponse);
    }

    @Transactional(readOnly = true)
    public Page<ApplicationResponse> listMyApplications(UUID candidateAuthUserId, Pageable pageable) {
        Page<Application> page = applicationRepository.findByCandidateAuthUserId(candidateAuthUserId, pageable);
        return page.map(this::mapToResponse);
    }

    @Transactional(readOnly = true)
    public Resource getApplicationFile(UUID id) {
        Application app = findApplicationOrThrow(id);
        if (app.getOriginalFilePath() == null) {
            throw new ResourceNotFoundException("No file found for application: " + id);
        }

        Path path = fileStorageUtil.getFilePath(app.getOriginalFilePath());
        Resource resource = new FileSystemResource(path);
        if (!resource.exists()) {
            throw new ResourceNotFoundException("File not found on disk for application: " + id);
        }
        return resource;
    }

    @Transactional
    public ApplicationDetailResponse updateApplicationStatus(UUID id, ApplicationStatus newStatus) {
        Application app = findApplicationOrThrow(id);
        app.setStatus(newStatus);
        Application saved = applicationRepository.save(app);
        log.info("Updated application id={} status to {}", id, newStatus);
        return mapToDetailResponse(saved);
    }

    public String getOriginalFilename(UUID id) {
        Application app = findApplicationOrThrow(id);
        return app.getOriginalFilename();
    }

    private Application findApplicationOrThrow(UUID id) {
        return applicationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Application not found with id: " + id));
    }

    private ApplicationResponse mapToResponse(Application app) {
        JobResponse jobResponse = null;
        if (app.getJobId() != null) {
            try {
                Job job = jobRepository.findById(app.getJobId()).orElse(null);
                if (job != null) {
                    jobResponse = JobResponse.builder()
                            .id(job.getId())
                            .orgId(job.getOrgId())
                            .title(job.getTitle())
                            .description(job.getDescription())
                            .location(job.getLocation())
                            .employmentType(job.getEmploymentType())
                            .experienceLevel(job.getExperienceLevel())
                            .status(job.getStatus())
                            .build();
                }
            } catch (Exception e) {
                log.warn("Failed to load job details for application {}: {}", app.getId(), e.getMessage());
            }
        }

        return ApplicationResponse.builder()
                .id(app.getId())
                .jobId(app.getJobId())
                .candidateAuthUserId(app.getCandidateAuthUserId())
                .job(jobResponse)
                .candidateName(app.getCandidateName())
                .candidateEmail(app.getCandidateEmail())
                .status(app.getStatus())
                .createdAt(app.getCreatedAt())
                .compositeScore(app.getCompositeScore())
                .rankingPosition(app.getRankingPosition())
                .build();
    }

    private ApplicationDetailResponse mapToDetailResponse(Application app) {
        return ApplicationDetailResponse.builder()
                .id(app.getId())
                .jobId(app.getJobId())
                .candidateAuthUserId(app.getCandidateAuthUserId())
                .candidateName(app.getCandidateName())
                .candidateEmail(app.getCandidateEmail())
                .coverLetter(app.getCoverLetter())
                .portfolioLinks(app.getPortfolioLinks())
                .contactPhone(app.getContactPhone())
                .candidateProfileSnapshot(app.getCandidateProfileSnapshot())
                .originalFilePath(app.getOriginalFilePath())
                .originalFilename(app.getOriginalFilename())
                .status(app.getStatus())
                .parseConfidence(app.getParseConfidence())
                .compositeScore(app.getCompositeScore())
                .rankingPosition(app.getRankingPosition())
                .createdAt(app.getCreatedAt())
                .updatedAt(app.getUpdatedAt())
                .build();
    }
}
