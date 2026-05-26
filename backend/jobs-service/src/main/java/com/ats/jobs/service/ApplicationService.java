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
import com.ats.jobs.feign.NotificationServiceClient;
import com.ats.jobs.feign.OrgServiceClient;
import com.ats.jobs.feign.UserServiceClient;
import com.ats.jobs.repository.ApplicationRepository;
import com.ats.jobs.repository.JobRepository;
import com.ats.jobs.util.FileStorageUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
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

    @Value("${app.frontend-url:http://localhost:3000}")
    private String frontendUrl;

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

    @Transactional
    public void waitlistApplications(UUID jobId, java.util.List<UUID> applicationIds, UUID orgId) {
        Job job = jobRepository.findById(jobId)
                .orElseThrow(() -> new ResourceNotFoundException("Job not found: " + jobId));

        if (orgId != null && !job.getOrgId().equals(orgId)) {
            throw new ForbiddenException("You do not have access to this job.");
        }

        java.util.List<Application> apps = applicationRepository.findAllById(applicationIds);
        for (Application app : apps) {
            if (app.getJobId().equals(jobId)) {
                app.setIsWaitlisted(true);
            }
        }
        applicationRepository.saveAll(apps);
        log.info("Waitlisted {} applications for job {}", applicationIds.size(), jobId);
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
                    String orgName = null;
                    try { orgName = orgServiceClient.getOrganizationName(job.getOrgId()); } catch (Exception ignored) {}
                    jobResponse = JobResponse.builder()
                            .id(job.getId())
                            .orgId(job.getOrgId())
                            .organizationName(orgName)
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
                .oaScore(app.getOaScore())
                .interviewScore(app.getInterviewScore())
                .finalRankingScore(app.getFinalRankingScore())
                .rankingPosition(app.getRankingPosition())
                .finalRank(app.getFinalRank())
                .isWaitlisted(app.getIsWaitlisted())
                .rejectionReason(app.getRejectionReason())
                .rejectedAt(app.getRejectedAt())
                .rejectedBy(app.getRejectedBy())
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
                .isWaitlisted(app.getIsWaitlisted())
                .rejectionReason(app.getRejectionReason())
                .rejectedAt(app.getRejectedAt())
                .rejectedBy(app.getRejectedBy())
                .createdAt(app.getCreatedAt())
                .updatedAt(app.getUpdatedAt())
                .build();
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

        // Send rejection email
        sendRejectionEmail(app, job.getTitle(), orgName, reason);

        return mapToDetailResponse(saved);
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

        for (Application app : apps) {
            if (!app.getJobId().equals(jobId)) continue;
            if (app.getStatus() == ApplicationStatus.REJECTED || app.getStatus() == ApplicationStatus.WITHDRAWN) continue;

            app.setStatus(ApplicationStatus.REJECTED);
            app.setRejectionReason(reason);
            app.setRejectedAt(LocalDateTime.now());
            app.setRejectedBy(rejectorId);
            applicationRepository.save(app);

            sendRejectionEmail(app, job.getTitle(), orgName, reason);
            if (app.getCandidateEmail() != null && !app.getCandidateEmail().isBlank()) {
                sentTo.add(app.getCandidateEmail());
            }
        }

        log.info("Bulk-rejected {} applications for job {}", sentTo.size(), jobId);
        return RejectResponse.builder()
                .rejectedCount(sentTo.size())
                .sentTo(sentTo)
                .build();
    }

    // ── Email helpers ─────────────────────────────────────────────────────────

    private void sendRejectionEmail(Application app, String jobTitle, String orgName, String optionalFeedback) {
        String email = app.getCandidateEmail();
        if (email == null || email.isBlank()) return;

        String candidateName = app.getCandidateName() != null ? app.getCandidateName() : "Candidate";
        String subject = "Update on Your Application — " + jobTitle + " at " + orgName;
        String body = buildRejectionEmailHtml(candidateName, jobTitle, orgName, optionalFeedback);

        try {
            notificationServiceClient.sendNotification(NotificationSendRequest.builder()
                    .recipientEmail(email)
                    .subject(subject)
                    .body(body)
                    .type("REJECTION")
                    .build());
            log.info("Rejection email sent to {} for application {}", email, app.getId());
        } catch (Exception e) {
            log.error("Failed to send rejection email to {}: {}", email, e.getMessage());
        }
    }

    /**
     * Builds a polished, brand-consistent HTML rejection email.
     * Includes candidate name, job title, company name, and optional personalised feedback.
     */
    private String buildRejectionEmailHtml(String candidateName, String jobTitle, String companyName, String optionalFeedback) {
        String feedbackBlock = "";
        if (optionalFeedback != null && !optionalFeedback.isBlank()) {
            feedbackBlock =
                "<div style=\"background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:20px 24px;margin-bottom:28px;\">" +
                "<p style=\"margin:0 0 8px;font-size:13px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.4px;\">Feedback</p>" +
                "<p style=\"margin:0;font-size:14px;color:#374151;line-height:1.7;\">" + escHtml(optionalFeedback) + "</p>" +
                "</div>";
        }

        return "<!DOCTYPE html>" +
            "<html lang=\"en\"><head><meta charset=\"UTF-8\">" +
            "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"></head>" +
            "<body style=\"margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;\">" +

            "<table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" role=\"presentation\">" +
            "<tr><td align=\"center\" style=\"padding:40px 16px;\">" +

            // Card
            "<table width=\"600\" cellpadding=\"0\" cellspacing=\"0\" role=\"presentation\" " +
            "style=\"background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);\">" +

            // Header
            "<tr><td style=\"background:#1f2937;padding:28px 36px;\">" +
            "<p style=\"margin:0;font-size:13px;color:#9ca3af;letter-spacing:.5px;text-transform:uppercase;\">" + escHtml(companyName) + "</p>" +
            "<h1 style=\"margin:6px 0 0;font-size:22px;color:#ffffff;font-weight:700;\">Application Update</h1>" +
            "</td></tr>" +

            // Body
            "<tr><td style=\"padding:36px 36px 28px;\">" +

            "<p style=\"margin:0 0 16px;font-size:15px;color:#374151;\">Dear <strong>" + escHtml(candidateName) + "</strong>,</p>" +

            "<p style=\"margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;\">" +
            "Thank you for taking the time to apply for the <strong>" + escHtml(jobTitle) + "</strong> position at " +
            "<strong>" + escHtml(companyName) + "</strong>. We genuinely appreciate your interest and the effort " +
            "you invested in your application.</p>" +

            "<p style=\"margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;\">" +
            "After careful review, we regret to inform you that we will not be moving forward with your candidacy " +
            "at this time. This was a difficult decision, as we received applications from many highly qualified " +
            "individuals. We have decided to proceed with candidates whose experience most closely aligns with the " +
            "current requirements of the role.</p>" +

            feedbackBlock +

            "<p style=\"margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;\">" +
            "We encourage you to apply for future opportunities that match your skills and experience. " +
            "We wish you every success in your job search and professional endeavors.</p>" +

            "<p style=\"margin:0 0 8px;font-size:15px;color:#374151;\">Warm regards,</p>" +
            "<p style=\"margin:0;font-size:15px;font-weight:600;color:#111827;\">" + escHtml(companyName) + " Recruitment Team</p>" +

            "<hr style=\"border:none;border-top:1px solid #e5e7eb;margin:28px 0 20px;\">" +
            "<p style=\"font-size:12px;color:#9ca3af;text-align:center;margin:0;\">" +
            "This message was sent automatically. Please do not reply to this email. If you have questions, " +
            "please contact the hiring team directly." +
            "</p>" +

            "</td></tr>" +
            "</table>" +   // end card
            "</td></tr></table>" + // end outer
            "</body></html>";
    }

    /** Minimal HTML escaping to prevent injection in email bodies. */
    private static String escHtml(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#x27;");
    }
}
