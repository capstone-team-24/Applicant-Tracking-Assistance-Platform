package com.ats.jobs.controller;

import com.ats.jobs.dto.ApplicationDataResponse;
import com.ats.jobs.dto.ReceivedAssessmentInviteResponse;
import com.ats.jobs.entity.Application;
import com.ats.jobs.entity.AssessmentInvite;
import com.ats.jobs.entity.Job;
import com.ats.jobs.enums.ApplicationStatus;
import com.ats.jobs.feign.OrgServiceClient;
import com.ats.jobs.feign.UserServiceClient;
import com.ats.jobs.repository.ApplicationRepository;
import com.ats.jobs.repository.AssessmentInviteRepository;
import com.ats.jobs.repository.JobRepository;
import com.ats.jobs.util.HeaderContext;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/applications/me")
@RequiredArgsConstructor
@Slf4j
public class AssessmentInviteController {

    private final AssessmentInviteRepository assessmentInviteRepository;
    private final ApplicationRepository applicationRepository;
    private final JobRepository jobRepository;
    private final OrgServiceClient orgServiceClient;
    private final UserServiceClient userServiceClient;

    @GetMapping("/assessment-invites")
    public ResponseEntity<List<ReceivedAssessmentInviteResponse>> getReceivedAssessments(
            HttpServletRequest request) {

        UUID authUserId = HeaderContext.getAuthUserId(request);
        if (authUserId == null) {
            return ResponseEntity.status(401).build();
        }

        List<AssessmentInvite> invites = assessmentInviteRepository
                .findByCandidateAuthUserIdOrderBySentAtDesc(authUserId, PageRequest.of(0, 50));

        Map<UUID, ApplicationStatus> applicationStatuses = applicationRepository.findAllById(
                        invites.stream()
                                .map(AssessmentInvite::getApplicationId)
                                .filter(Objects::nonNull)
                                .distinct()
                                .toList())
                .stream()
                .collect(Collectors.toMap(Application::getId, Application::getStatus));

        List<ReceivedAssessmentInviteResponse> response = invites.stream()
                .filter(invite -> shouldShowInvite(invite, authUserId, applicationStatuses))
                .map(i -> {
                    String orgName = i.getOrganizationName();
                    if (orgName == null && i.getJobId() != null) {
                        try {
                            Job job = jobRepository.findById(i.getJobId()).orElse(null);
                            if (job != null) orgName = orgServiceClient.getOrganizationName(job.getOrgId());
                        } catch (Exception ignored) {}
                    }
                    String appealContactEmail = firstNonBlank(
                            i.getSentByEmail(),
                            resolveRecruiterEmail(i.getSentByAuthUserId()));
                    return ReceivedAssessmentInviteResponse.builder()
                            .id(i.getId())
                            .jobId(i.getJobId())
                            .jobTitle(i.getJobTitle())
                            .organizationName(orgName)
                            .assessmentToken(i.getAssessmentToken())
                            .assessmentTitle(i.getAssessmentTitle())
                            .timeLimitMinutes(i.getTimeLimitMinutes())
                            .sentAt(i.getSentAt() != null ? i.getSentAt().toString() : null)
                            .expiresAt(i.getExpiresAt() != null ? i.getExpiresAt().toString() : null)
                            .appealContactEmail(appealContactEmail)
                            .build();
                })
                .toList();

        return ResponseEntity.ok(response);
    }

    private boolean shouldShowInvite(
            AssessmentInvite invite,
            UUID candidateAuthUserId,
            Map<UUID, ApplicationStatus> applicationStatuses) {
        if (invite.getApplicationId() != null) {
            return applicationStatuses.get(invite.getApplicationId()) == ApplicationStatus.OA_INVITED;
        }
        if (invite.getJobId() == null) {
            return false;
        }

        return applicationRepository.findByJobIdAndCandidateAuthUserId(invite.getJobId(), candidateAuthUserId)
                .stream()
                .anyMatch(application -> application.getStatus() == ApplicationStatus.OA_INVITED);
    }

    private String resolveRecruiterEmail(UUID recruiterAuthUserId) {
        if (recruiterAuthUserId == null) {
            return null;
        }
        try {
            ApplicationDataResponse profile = userServiceClient.getApplicationData(recruiterAuthUserId);
            if (profile != null && profile.getEmail() != null && !profile.getEmail().isBlank()) {
                return profile.getEmail();
            }
        } catch (Exception e) {
            log.warn("Could not resolve recruiter email for {}: {}", recruiterAuthUserId, e.getMessage());
        }
        return null;
    }

    private String firstNonBlank(String... values) {
        if (values == null) {
            return null;
        }
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return null;
    }
}
