package com.ats.jobs.service;

import com.ats.jobs.config.KafkaConfig;
import com.ats.jobs.dto.*;
import com.ats.jobs.entity.Application;
import com.ats.jobs.entity.Job;
import com.ats.jobs.enums.ApplicationStatus;
import com.ats.jobs.enums.JobStatus;
import com.ats.jobs.exception.BadRequestException;
import com.ats.jobs.exception.ForbiddenException;
import com.ats.jobs.exception.ResourceNotFoundException;
import com.ats.jobs.exception.ServiceUnavailableException;
import com.ats.jobs.feign.NotificationServiceClient;
import com.ats.jobs.feign.OrgServiceClient;
import com.ats.jobs.feign.UserServiceClient;
import com.ats.jobs.repository.ApplicationRepository;
import com.ats.jobs.repository.JobRepository;
import com.ats.jobs.util.FileStorageUtil;
import com.ats.jobs.util.EmailTemplate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.client.RestClientException;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
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
    private final OrgServiceClient orgServiceClient;
    private final NotificationServiceClient notificationServiceClient;
    private final RestTemplate restTemplate;

    @Value("${app.frontend-url:http://localhost:3000}")
    private String frontendUrl;

    @Value("${app.hiring-rag-service-url:http://localhost:8090}")
    private String hiringRagServiceUrl;

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
        Map<String, Object> notificationPayload = new HashMap<>();
        notificationPayload.put("applicationId", saved.getId().toString());
        notificationPayload.put("jobId", jobId.toString());
        notificationPayload.put("candidateAuthUserId", effectiveCandidateId != null ? effectiveCandidateId.toString() : null);
        notificationPayload.put("candidateEmail", saved.getCandidateEmail());
        notificationPayload.put("candidateName", saved.getCandidateName());
        notificationPayload.put("jobTitle", job.getTitle());

        ApplicationSubmittedEvent event = ApplicationSubmittedEvent.builder()
                .applicationId(saved.getId())
                .jobId(jobId)
                .candidateAuthUserId(effectiveCandidateId)
                .filePath(filePath)
                .createdAt(LocalDateTime.now())
                .eventType(KafkaConfig.APPLICATION_SUBMITTED_TOPIC)
                .payload(notificationPayload)
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
    public ApplicationDetailResponse getApplicationForRecruiter(UUID id, UUID orgId) {
        Application app = findApplicationOrThrow(id);
        assertRecruiterOrgAccess(app, orgId);
        return mapToDetailResponse(app);
    }

    @Transactional(readOnly = true)
    public CandidateApplicationDetailResponse getMyApplicationDetail(UUID id, UUID candidateAuthUserId) {
        Application app = findApplicationOrThrow(id);
        assertCandidateAccess(app, candidateAuthUserId);
        return mapToCandidateDetailResponse(app);
    }

    @Transactional(readOnly = true)
    public ApplicationExplainResponse explainApplicationMatch(UUID id, UUID orgId) {
        Application app = findApplicationOrThrow(id);
        assertRecruiterOrgAccess(app, orgId);

        Job job = jobRepository.findById(app.getJobId())
                .orElseThrow(() -> new ResourceNotFoundException("Job not found: " + app.getJobId()));

        if (app.getOriginalFilePath() == null || app.getOriginalFilePath().isBlank()) {
            throw new ResourceNotFoundException("No resume file found for application: " + id);
        }

        String jobDescription = buildJobDescriptionForRag(job);
        Map<String, Object> request = new HashMap<>();
        request.put("job_id", job.getId().toString());
        request.put("job_description", jobDescription);
        request.put("resume_id", app.getId().toString());
        request.put("candidate_id", app.getCandidateAuthUserId() != null ? app.getCandidateAuthUserId().toString() : app.getId().toString());
        request.put("file_path", app.getOriginalFilePath());

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        Map<String, Object> response;
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> ragResponse = restTemplate.postForObject(
                    hiringRagServiceUrl + "/explain",
                    new HttpEntity<>(request, headers),
                    Map.class);
            response = ragResponse;
        } catch (RestClientException e) {
            log.warn("Hiring RAG explanation request failed for application {}: {}", id, e.getMessage());
            throw new ServiceUnavailableException("AI explanation service is not available yet. Please try again in a moment.");
        }

        if (response == null) {
            throw new BadRequestException("The hiring RAG service did not return an explanation.");
        }

        return mapExplainResponse(app, response);
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
        return page.map(this::mapToCandidateResponse);
    }

    @Transactional(readOnly = true)
    public Resource getApplicationFileForRecruiter(UUID id, UUID orgId) {
        Application app = findApplicationOrThrow(id);
        assertRecruiterOrgAccess(app, orgId);
        return getApplicationFileResource(app);
    }

    @Transactional(readOnly = true)
    public Resource getMyApplicationFile(UUID id, UUID candidateAuthUserId) {
        Application app = findApplicationOrThrow(id);
        assertCandidateAccess(app, candidateAuthUserId);
        return getApplicationFileResource(app);
    }

    @Transactional
    public ApplicationDetailResponse updateApplicationStatus(UUID id, ApplicationStatus newStatus) {
        Application app = findApplicationOrThrow(id);
        app.setStatus(newStatus);
        Application saved = applicationRepository.save(app);
        log.info("Updated application id={} status to {}", id, newStatus);
        return mapToDetailResponse(saved);
    }

    @Transactional
    public void recalculateFinalRanking(UUID jobId, UUID orgId) {
        Job job = jobRepository.findById(jobId)
                .orElseThrow(() -> new ResourceNotFoundException("Job not found: " + jobId));

        if (orgId != null && !job.getOrgId().equals(orgId)) {
            throw new ForbiddenException("You do not have access to this job.");
        }

        java.util.List<Application> apps = applicationRepository.findByJobId(jobId);
        for (Application app : apps) {
            double cvScore = app.getCompositeScore() != null ? app.getCompositeScore() : 0.0;
            double oaScore = app.getOaScore() != null ? app.getOaScore() : 0.0;
            double interviewScore = app.getInterviewScore() != null ? app.getInterviewScore() : 0.0;
            
            double finalRankingScore = Math.round(((cvScore + oaScore + (interviewScore * 2)) / 3.0) * 100.0) / 100.0;
            app.setFinalRankingScore(finalRankingScore);
        }
        
        apps.sort((a, b) -> {
            double scoreA = a.getFinalRankingScore() != null ? a.getFinalRankingScore() : 0.0;
            double scoreB = b.getFinalRankingScore() != null ? b.getFinalRankingScore() : 0.0;
            return Double.compare(scoreB, scoreA);
        });
        
        int rank = 1;
        for (Application app : apps) {
            if (app.getFinalRankingScore() != null && app.getFinalRankingScore() > 0) {
                app.setFinalRank(rank++);
            } else {
                app.setFinalRank(null);
            }
        }
        
        applicationRepository.saveAll(apps);
        log.info("Recalculated final ranking for job {}", jobId);
    }

    public String getOriginalFilenameForRecruiter(UUID id, UUID orgId) {
        Application app = findApplicationOrThrow(id);
        assertRecruiterOrgAccess(app, orgId);
        return app.getOriginalFilename();
    }

    @Transactional(readOnly = true)
    public String getMyOriginalFilename(UUID id, UUID candidateAuthUserId) {
        Application app = findApplicationOrThrow(id);
        assertCandidateAccess(app, candidateAuthUserId);
        return app.getOriginalFilename();
    }

    private Application findApplicationOrThrow(UUID id) {
        return applicationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Application not found with id: " + id));
    }

    private ApplicationResponse mapToResponse(Application app) {
        JobResponse jobResponse = buildJobResponse(app.getJobId(), true);

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
                .oaScore(app.getOaScore())
                .interviewScore(app.getInterviewScore())
                .finalRankingScore(app.getFinalRankingScore())
                .rankingPosition(app.getRankingPosition())
                .finalRank(app.getFinalRank())
                .rejectionReason(app.getRejectionReason())
                .rejectedAt(app.getRejectedAt())
                .rejectedBy(app.getRejectedBy())
                .build();
    }

    private ApplicationResponse mapToCandidateResponse(Application app) {
        return ApplicationResponse.builder()
                .id(app.getId())
                .jobId(app.getJobId())
                .job(buildJobResponse(app.getJobId(), false))
                .candidateName(app.getCandidateName())
                .candidateEmail(app.getCandidateEmail())
                .status(app.getStatus())
                .createdAt(app.getCreatedAt())
                .rejectionReason(app.getRejectionReason())
                .rejectedAt(app.getRejectedAt())
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
                .oaScore(app.getOaScore())
                .interviewScore(app.getInterviewScore())
                .finalRankingScore(app.getFinalRankingScore())
                .rankingPosition(app.getRankingPosition())
                .finalRank(app.getFinalRank())
                .rejectionReason(app.getRejectionReason())
                .rejectedAt(app.getRejectedAt())
                .rejectedBy(app.getRejectedBy())
                .createdAt(app.getCreatedAt())
                .updatedAt(app.getUpdatedAt())
                .build();
    }

    private CandidateApplicationDetailResponse mapToCandidateDetailResponse(Application app) {
        return CandidateApplicationDetailResponse.builder()
                .id(app.getId())
                .jobId(app.getJobId())
                .job(buildJobResponse(app.getJobId(), false))
                .candidateName(app.getCandidateName())
                .candidateEmail(app.getCandidateEmail())
                .coverLetter(app.getCoverLetter())
                .portfolioLinks(app.getPortfolioLinks())
                .contactPhone(app.getContactPhone())
                .candidateProfileSnapshot(app.getCandidateProfileSnapshot())
                .originalFilename(app.getOriginalFilename())
                .status(app.getStatus())
                .rejectionReason(app.getRejectionReason())
                .rejectedAt(app.getRejectedAt())
                .createdAt(app.getCreatedAt())
                .updatedAt(app.getUpdatedAt())
                .build();
    }

    private JobResponse buildJobResponse(UUID jobId, boolean includeRecruiterFields) {
        if (jobId == null) {
            return null;
        }

        try {
            Job job = jobRepository.findById(jobId).orElse(null);
            if (job == null) {
                return null;
            }

            String orgName = null;
            try {
                orgName = orgServiceClient.getOrganizationName(job.getOrgId());
            } catch (Exception ignored) {
            }

            JobResponse.JobResponseBuilder builder = JobResponse.builder()
                    .id(job.getId())
                    .organizationName(orgName)
                    .title(job.getTitle())
                    .description(job.getDescription())
                    .requirements(job.getRequirements())
                    .location(job.getLocation())
                    .employmentType(job.getEmploymentType())
                    .experienceLevel(job.getExperienceLevel())
                    .skills(job.getSkills())
                    .status(job.getStatus())
                    .applicationDeadline(job.getApplicationDeadline())
                    .createdAt(job.getCreatedAt())
                    .updatedAt(job.getUpdatedAt())
                    .publishedAt(job.getPublishedAt())
                    .closedAt(job.getClosedAt());

            if (includeRecruiterFields) {
                builder.orgId(job.getOrgId())
                        .createdBy(job.getCreatedBy())
                        .assignedTo(job.getEffectiveAssignedRecruiterIds().stream().findFirst().orElse(null))
                        .assignedRecruiterIds(new ArrayList<>(job.getEffectiveAssignedRecruiterIds()));
            }

            return builder.build();
        } catch (Exception e) {
            log.warn("Failed to load job details for application {}: {}", jobId, e.getMessage());
            return null;
        }
    }

    private String buildJobDescriptionForRag(Job job) {
        StringBuilder description = new StringBuilder();
        if (job.getTitle() != null && !job.getTitle().isBlank()) {
            description.append("Title: ").append(job.getTitle()).append("\n\n");
        }
        if (job.getDescription() != null && !job.getDescription().isBlank()) {
            description.append(job.getDescription()).append("\n\n");
        }
        if (job.getRequirements() != null && !job.getRequirements().isBlank()) {
            description.append("Requirements: ").append(job.getRequirements()).append("\n\n");
        }
        if (job.getSkills() != null && !job.getSkills().isEmpty()) {
            description.append("Skills: ").append(String.join(", ", job.getSkills()));
        }
        return description.toString().trim();
    }

    private ApplicationExplainResponse mapExplainResponse(Application app, Map<String, Object> response) {
        return ApplicationExplainResponse.builder()
                .applicationId(app.getId())
                .jobId(app.getJobId())
                .candidateAuthUserId(app.getCandidateAuthUserId())
                .score(asDouble(response.get("score")))
                .analysis(mapExplainAnalysis(response.get("analysis")))
                .analysisError(response.get("analysis_error") != null ? response.get("analysis_error").toString() : null)
                .build();
    }

    @SuppressWarnings("unchecked")
    private ApplicationExplainResponse.Analysis mapExplainAnalysis(Object value) {
        if (!(value instanceof Map<?, ?> raw)) {
            return null;
        }

        Object strengthsValue = raw.get("strengths");
        List<String> strengths = strengthsValue instanceof List<?> values
                ? values.stream().filter(item -> item != null).map(Object::toString).toList()
                : List.of();

        return ApplicationExplainResponse.Analysis.builder()
                .summary(raw.get("summary") != null ? raw.get("summary").toString() : null)
                .strengths(strengths)
                .gap(raw.get("gap") != null ? raw.get("gap").toString() : null)
                .recommendation(raw.get("recommendation") != null ? raw.get("recommendation").toString() : null)
                .build();
    }

    private Double asDouble(Object value) {
        if (value instanceof Number number) {
            return number.doubleValue();
        }
        if (value == null) {
            return null;
        }
        try {
            return Double.parseDouble(value.toString());
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private Resource getApplicationFileResource(Application app) {
        if (app.getOriginalFilePath() == null) {
            throw new ResourceNotFoundException("No file found for application: " + app.getId());
        }

        Path path = fileStorageUtil.getFilePath(app.getOriginalFilePath());
        Resource resource = new FileSystemResource(path);
        if (!resource.exists()) {
            throw new ResourceNotFoundException("File not found on disk for application: " + app.getId());
        }
        return resource;
    }

    private void assertCandidateAccess(Application app, UUID candidateAuthUserId) {
        if (candidateAuthUserId == null || app.getCandidateAuthUserId() == null
                || !candidateAuthUserId.equals(app.getCandidateAuthUserId())) {
            throw new ForbiddenException("You do not have access to this application.");
        }
    }

    private void assertRecruiterOrgAccess(Application app, UUID orgId) {
        if (orgId == null) {
            return;
        }

        Job job = jobRepository.findById(app.getJobId())
                .orElseThrow(() -> new ResourceNotFoundException("Job not found: " + app.getJobId()));

        if (!orgId.equals(job.getOrgId())) {
            throw new ForbiddenException("You do not have access to this application.");
        }
    }

    // ── Rejection methods ─────────────────────────────────────────────────────

    /**
     * Reject a single application, store audit fields, and send a styled rejection email.
     */
    @Transactional
    public ApplicationDetailResponse rejectApplication(UUID applicationId, UUID rejectorId, String reason) {
        Application app = findApplicationOrThrow(applicationId);

        if (app.getStatus() == ApplicationStatus.REJECTED) {
            throw new BadRequestException("Application is already rejected.");
        }
        if (app.getStatus() == ApplicationStatus.DISQUALIFIED) {
            throw new BadRequestException("Application is already disqualified.");
        }

        Job job = jobRepository.findById(app.getJobId())
                .orElseThrow(() -> new ResourceNotFoundException("Job not found: " + app.getJobId()));

        String orgName = "the company";
        try { orgName = orgServiceClient.getOrganizationName(job.getOrgId()); } catch (Exception ignored) {}

        // Persist rejection
        app.setStatus(ApplicationStatus.REJECTED);
        app.setRejectionReason(reason);
        app.setRejectedAt(LocalDateTime.now());
        app.setRejectedBy(rejectorId);
        Application saved = applicationRepository.save(app);
        log.info("Rejected application id={} by recruiter={}", applicationId, rejectorId);

        EmailSendResult emailResult = sendRejectionEmail(saved, job.getTitle(), orgName, reason);

        ApplicationDetailResponse response = mapToDetailResponse(saved);
        response.setRejectionEmailSent(emailResult.sent());
        response.setRejectionEmailError(emailResult.error());
        return response;
    }

    /**
     * Bulk reject a list of applications, store audit fields on each, and send styled emails.
     */
    @Transactional
    public RejectResponse bulkRejectApplications(UUID jobId, List<UUID> applicationIds, UUID rejectorId, String reason, UUID orgId) {
        Job job = jobRepository.findById(jobId)
                .orElseThrow(() -> new ResourceNotFoundException("Job not found: " + jobId));

        if (orgId != null && !job.getOrgId().equals(orgId)) {
            throw new ForbiddenException("You do not have access to this job.");
        }

        String orgName = "the company";
        try { orgName = orgServiceClient.getOrganizationName(job.getOrgId()); } catch (Exception ignored) {}

        List<Application> apps = applicationRepository.findAllById(applicationIds);
        List<String> sentTo = new ArrayList<>();
        int rejectedCount = 0;

        for (Application app : apps) {
            if (!app.getJobId().equals(jobId)) continue;
            if (app.getStatus() == ApplicationStatus.REJECTED ||
                    app.getStatus() == ApplicationStatus.WITHDRAWN ||
                    app.getStatus() == ApplicationStatus.DISQUALIFIED) {
                continue;
            }

            app.setStatus(ApplicationStatus.REJECTED);
            app.setRejectionReason(reason);
            app.setRejectedAt(LocalDateTime.now());
            app.setRejectedBy(rejectorId);
            Application saved = applicationRepository.save(app);
            rejectedCount++;

            EmailSendResult emailResult = sendRejectionEmail(saved, job.getTitle(), orgName, reason);
            if (emailResult.sent() && saved.getCandidateEmail() != null && !saved.getCandidateEmail().isBlank()) {
                sentTo.add(saved.getCandidateEmail());
            }
        }

        log.info("Bulk-rejected {} applications for job {}; sent {} rejection emails", rejectedCount, jobId, sentTo.size());
        return RejectResponse.builder()
                .rejectedCount(rejectedCount)
                .sentTo(sentTo)
                .build();
    }

    // ── Email helpers ─────────────────────────────────────────────────────────

    private record EmailSendResult(boolean sent, String error) {}

    private EmailSendResult sendRejectionEmail(Application app, String jobTitle, String orgName, String optionalFeedback) {
        String email = app.getCandidateEmail();
        if (email == null || email.isBlank()) {
            return new EmailSendResult(false, "Candidate email is missing.");
        }

        String candidateName = app.getCandidateName() != null ? app.getCandidateName() : "Candidate";
        String subject = "Update on Your Application — " + jobTitle + " at " + orgName;
        String body = buildRejectionEmailHtml(candidateName, jobTitle, orgName, optionalFeedback);

        try {
            NotificationResponse response = notificationServiceClient.sendNotification(NotificationSendRequest.builder()
                    .recipientEmail(email)
                    .recipientUserId(app.getCandidateAuthUserId())
                    .subject(subject)
                    .body(body)
                    .type("REJECTION")
                    .build());
            if (response == null || response.getStatus() == null || !response.getStatus().equalsIgnoreCase("SENT")) {
                String error = response != null ? response.getErrorMessage() : "Notification service did not return a response.";
                log.error("Rejection email to {} for application {} was not sent: {}", email, app.getId(), error);
                return new EmailSendResult(false, error != null ? error : "Notification service did not mark the email as sent.");
            }
            log.info("Rejection email sent to {} for application {}", email, app.getId());
            return new EmailSendResult(true, null);
        } catch (Exception e) {
            log.error("Failed to send rejection email to {}: {}", email, e.getMessage());
            return new EmailSendResult(false, e.getMessage());
        }
    }

    /**
     * Builds a polished, brand-consistent HTML rejection email.
     * Includes candidate name, job title, company name, and optional personalised feedback.
     */
    private String buildRejectionEmailHtml(String candidateName, String jobTitle, String companyName, String optionalFeedback) {
        String feedbackBlock = "";
        if (optionalFeedback != null && !optionalFeedback.isBlank()) {
            feedbackBlock = EmailTemplate.infoBox("Feedback", EmailTemplate.escape(optionalFeedback));
        }

        String content = EmailTemplate.paragraph("Dear <strong>" + EmailTemplate.escape(candidateName) + "</strong>,")
                + EmailTemplate.paragraph("Thank you for taking the time to apply for the <strong>" + EmailTemplate.escape(jobTitle) + "</strong> position at <strong>" + EmailTemplate.escape(companyName) + "</strong>. We genuinely appreciate your interest and the effort you invested in your application.")
                + EmailTemplate.paragraph("After careful review, we regret to inform you that we will not be moving forward with your candidacy at this time. This was a difficult decision, as we received applications from many highly qualified individuals. We have decided to proceed with candidates whose experience most closely aligns with the current requirements of the role.")
                + feedbackBlock
                + EmailTemplate.paragraph("We encourage you to apply for future opportunities that match your skills and experience. We wish you every success in your job search and professional endeavors.")
                + EmailTemplate.paragraph("Warm regards,<br/><strong>" + EmailTemplate.escape(companyName) + " Recruitment Team</strong>");
        return EmailTemplate.render("Application Update", content, "Please do not reply to this email. If you have questions, contact the hiring team directly.");
    }
}
