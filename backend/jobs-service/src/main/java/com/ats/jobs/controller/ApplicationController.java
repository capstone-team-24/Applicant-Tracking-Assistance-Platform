package com.ats.jobs.controller;

import com.ats.jobs.dto.*;
import com.ats.jobs.enums.ApplicationStatus;
import jakarta.validation.Valid;
import com.ats.jobs.service.ApplicationService;
import com.ats.jobs.service.AssessmentInviteService;
import com.ats.jobs.service.InterviewInviteService;
import com.ats.jobs.util.HeaderContext;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class ApplicationController {

    private final ApplicationService applicationService;
    private final AssessmentInviteService assessmentInviteService;
    private final InterviewInviteService interviewInviteService;

    @PostMapping(value = "/api/v1/jobs/{jobId}/apply", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApplicationResponse> apply(
            @PathVariable UUID jobId,
            @RequestPart("request") ApplyRequest request,
            @RequestPart(value = "file", required = false) MultipartFile file,
            HttpServletRequest httpRequest) {

        UUID orgId = HeaderContext.getOrgId(httpRequest);
        UUID candidateAuthUserId = HeaderContext.getAuthUserId(httpRequest);

        ApplicationResponse response = applicationService.apply(jobId, request, file, orgId, candidateAuthUserId);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/api/v1/jobs/{jobId}/applications")
    public ResponseEntity<Page<ApplicationResponse>> listApplications(
            @PathVariable UUID jobId,
            @RequestParam(required = false) ApplicationStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir,
            HttpServletRequest httpRequest) {

        HeaderContext.assertRecruiter(httpRequest);

        Sort sort = sortDir.equalsIgnoreCase("asc")
                ? Sort.by(sortBy).ascending()
                : Sort.by(sortBy).descending();
        Pageable pageable = PageRequest.of(page, size, sort);

        Page<ApplicationResponse> result = applicationService.listApplications(jobId, status, pageable);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/api/v1/applications/{id}")
    public ResponseEntity<ApplicationDetailResponse> getApplication(@PathVariable UUID id) {
        ApplicationDetailResponse response = applicationService.getApplication(id);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/api/v1/applications/me")
    public ResponseEntity<Page<ApplicationResponse>> getMyApplications(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir,
            HttpServletRequest httpRequest) {

        UUID candidateAuthUserId = HeaderContext.getAuthUserId(httpRequest);

        Sort sort = sortDir.equalsIgnoreCase("asc")
                ? Sort.by(sortBy).ascending()
                : Sort.by(sortBy).descending();
        Pageable pageable = PageRequest.of(page, size, sort);

        Page<ApplicationResponse> result = applicationService.listMyApplications(candidateAuthUserId, pageable);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/api/v1/applications/{id}/file")
    public ResponseEntity<Resource> downloadFile(@PathVariable UUID id) {
        Resource resource = applicationService.getApplicationFile(id);
        String filename = applicationService.getOriginalFilename(id);

        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + (filename != null ? filename : "download") + "\"")
                .body(resource);
    }

    @GetMapping("/api/v1/applications/{id}/status")
    public ResponseEntity<ApplicationResponse> getApplicationStatus(@PathVariable UUID id) {
        ApplicationDetailResponse detail = applicationService.getApplication(id);
        ApplicationResponse response = ApplicationResponse.builder()
                .id(detail.getId())
                .jobId(detail.getJobId())
                .candidateName(detail.getCandidateName())
                .candidateEmail(detail.getCandidateEmail())
                .status(detail.getStatus())
                .createdAt(detail.getCreatedAt())
                .compositeScore(detail.getCompositeScore())
                .rankingPosition(detail.getRankingPosition())
                .build();
        return ResponseEntity.ok(response);
    }

    @PutMapping("/api/v1/applications/{id}/status")
    public ResponseEntity<ApplicationDetailResponse> updateApplicationStatus(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateStatusRequest request,
            HttpServletRequest httpRequest) {
        HeaderContext.assertRecruiter(httpRequest);
        ApplicationDetailResponse response = applicationService.updateApplicationStatus(id, request.getStatus());
        return ResponseEntity.ok(response);
    }

    /**
     * POST /api/v1/applications/{id}/send-oa
     *
     * Manually send an OA invite to a single candidate, bypassing AI ranking.
     * The recruiter must supply the same assessment details as in the bulk flow.
     */
    @PostMapping("/api/v1/applications/{id}/send-oa")
    public ResponseEntity<SendAssessmentResponse> sendOAToApplication(
            @PathVariable UUID id,
            @RequestBody SendAssessmentRequest request,
            HttpServletRequest httpRequest) {

        HeaderContext.assertRecruiter(httpRequest);
        UUID orgId = HeaderContext.getOrgId(httpRequest);
        SendAssessmentResponse response = assessmentInviteService.sendAssessmentToApplication(id, request, orgId);
        return ResponseEntity.ok(response);
    }

    /**
     * POST /api/v1/applications/{id}/send-interview-invite
     *
     * Manually send an interview invite to a single candidate, bypassing OA
     * score filtering and topN cap.
     */
    @PostMapping("/api/v1/applications/{id}/send-interview-invite")
    public ResponseEntity<SendInterviewInviteResponse> sendInterviewInviteToApplication(
            @PathVariable UUID id,
            @RequestBody(required = false) SendSingleInterviewInviteRequest request,
            HttpServletRequest httpRequest) {

        HeaderContext.assertRecruiter(httpRequest);
        UUID orgId = HeaderContext.getOrgId(httpRequest);
        SendInterviewInviteResponse response = interviewInviteService.sendInterviewInviteToApplication(id, request, orgId);
        return ResponseEntity.ok(response);
    }
}
