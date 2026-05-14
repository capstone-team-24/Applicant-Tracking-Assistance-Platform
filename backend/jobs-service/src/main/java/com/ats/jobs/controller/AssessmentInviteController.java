package com.ats.jobs.controller;

import com.ats.jobs.dto.ReceivedAssessmentInviteResponse;
import com.ats.jobs.entity.AssessmentInvite;
import com.ats.jobs.entity.Job;
import com.ats.jobs.feign.OrgServiceClient;
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
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/applications/me")
@RequiredArgsConstructor
@Slf4j
public class AssessmentInviteController {

    private final AssessmentInviteRepository assessmentInviteRepository;
    private final JobRepository jobRepository;
    private final OrgServiceClient orgServiceClient;

    @GetMapping("/assessment-invites")
    public ResponseEntity<List<ReceivedAssessmentInviteResponse>> getReceivedAssessments(
            HttpServletRequest request) {

        UUID authUserId = HeaderContext.getAuthUserId(request);
        if (authUserId == null) {
            return ResponseEntity.status(401).build();
        }

        List<AssessmentInvite> invites = assessmentInviteRepository
                .findByCandidateAuthUserIdOrderBySentAtDesc(authUserId, PageRequest.of(0, 50));

        List<ReceivedAssessmentInviteResponse> response = invites.stream()
                .map(i -> {
                    String orgName = i.getOrganizationName();
                    if (orgName == null && i.getJobId() != null) {
                        try {
                            Job job = jobRepository.findById(i.getJobId()).orElse(null);
                            if (job != null) orgName = orgServiceClient.getOrganizationName(job.getOrgId());
                        } catch (Exception ignored) {}
                    }
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
                            .build();
                })
                .toList();

        return ResponseEntity.ok(response);
    }
}
