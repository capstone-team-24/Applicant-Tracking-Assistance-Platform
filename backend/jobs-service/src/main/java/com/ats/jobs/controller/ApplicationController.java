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
    public ResponseEntity<ApplicationDetailResponse> getApplication(
            @PathVariable UUID id,
            HttpServletRequest httpRequest) {
        HeaderContext.assertRecruiter(httpRequest);
        UUID orgId = HeaderContext.getOrgId(httpRequest);
        ApplicationDetailResponse response = applicationService.getApplicationForRecruiter(id, orgId);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/api/v1/applications/me/{id}")
    public ResponseEntity<CandidateApplicationDetailResponse> getMyApplication(
            @PathVariable UUID id,
            HttpServletRequest httpRequest) {

        HeaderContext.assertCandidate(httpRequest);
        UUID candidateAuthUserId = HeaderContext.getAuthUserId(httpRequest);
        CandidateApplicationDetailResponse response = applicationService.getMyApplicationDetail(id, candidateAuthUserId);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/api/v1/applications/me")
    public ResponseEntity<Page<ApplicationResponse>> getMyApplications(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir,
            HttpServletRequest httpRequest) {

        HeaderContext.assertCandidate(httpRequest);
        UUID candidateAuthUserId = HeaderContext.getAuthUserId(httpRequest);

        Sort sort = sortDir.equalsIgnoreCase("asc")
                ? Sort.by(sortBy).ascending()
                : Sort.by(sortBy).descending();
        Pageable pageable = PageRequest.of(page, size, sort);

        Page<ApplicationResponse> result = applicationService.listMyApplications(candidateAuthUserId, pageable);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/api/v1/applications/{id}/file")
    public ResponseEntity<Resource> downloadFile(
            @PathVariable UUID id,
            HttpServletRequest httpRequest) {
        HeaderContext.assertRecruiter(httpRequest);
        UUID orgId = HeaderContext.getOrgId(httpRequest);
        Resource resource = applicationService.getApplicationFileForRecruiter(id, orgId);
        String filename = applicationService.getOriginalFilenameForRecruiter(id, orgId);

        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + (filename != null ? filename : "download") + "\"")
                .body(resource);
    }

    @GetMapping("/api/v1/applications/me/{id}/file")
    public ResponseEntity<Resource> downloadMyFile(
            @PathVariable UUID id,
            HttpServletRequest httpRequest) {
        HeaderContext.assertCandidate(httpRequest);
        UUID candidateAuthUserId = HeaderContext.getAuthUserId(httpRequest);
        Resource resource = applicationService.getMyApplicationFile(id, candidateAuthUserId);
        String filename = applicationService.getMyOriginalFilename(id, candidateAuthUserId);

        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + (filename != null ? filename : "download") + "\"")
                .body(resource);
    }

    @GetMapping("/api/v1/applications/{id}/status")
    public ResponseEntity<ApplicationResponse> getApplicationStatus(
            @PathVariable UUID id,
            HttpServletRequest httpRequest) {
        HeaderContext.assertRecruiter(httpRequest);
        UUID orgId = HeaderContext.getOrgId(httpRequest);
        ApplicationDetailResponse detail = applicationService.getApplicationForRecruiter(id, orgId);
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

    @PostMapping("/api/v1/applications/{id}/explain")
    public ResponseEntity<ApplicationExplainResponse> explainApplicationMatch(
            @PathVariable UUID id,
            HttpServletRequest httpRequest) {
        HeaderContext.assertRecruiter(httpRequest);
        UUID orgId = HeaderContext.getOrgId(httpRequest);
        ApplicationExplainResponse response = applicationService.explainApplicationMatch(id, orgId);
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
        UUID recruiterAuthUserId = HeaderContext.getAuthUserId(httpRequest);
        SendAssessmentResponse response = assessmentInviteService.sendAssessmentToApplication(id, request, orgId, recruiterAuthUserId);
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

    /**
     * POST /api/v1/jobs/{jobId}/applications/recalculate-ranking
     *
     * Recalculates the final ranking for all applications of a job.
     */
    @PostMapping("/api/v1/jobs/{jobId}/applications/recalculate-ranking")
    public ResponseEntity<Void> recalculateFinalRanking(
            @PathVariable UUID jobId,
            HttpServletRequest httpRequest) {

        HeaderContext.assertRecruiter(httpRequest);
        UUID orgId = HeaderContext.getOrgId(httpRequest);
        applicationService.recalculateFinalRanking(jobId, orgId);
        return ResponseEntity.ok().build();
    }

    /**
     * POST /api/v1/applications/{id}/reject
     *
     * Reject a single application and send a styled rejection email.
     * Stores rejectionReason, rejectedAt, and rejectedBy on the application.
     */
    @PostMapping("/api/v1/applications/{id}/reject")
    public ResponseEntity<ApplicationDetailResponse> rejectApplication(
            @PathVariable UUID id,
            @RequestBody(required = false) RejectRequest request,
            HttpServletRequest httpRequest) {

        HeaderContext.assertRecruiter(httpRequest);
        UUID rejectorId = HeaderContext.getAuthUserId(httpRequest);
        String reason = request != null ? request.getReason() : null;
        ApplicationDetailResponse response = applicationService.rejectApplication(id, rejectorId, reason);
        return ResponseEntity.ok(response);
    }

    /**
     * POST /api/v1/jobs/{jobId}/applications/bulk-reject
     *
     * Bulk-reject a list of applications and send rejection emails to each.
     */
    @PostMapping("/api/v1/jobs/{jobId}/applications/bulk-reject")
    public ResponseEntity<RejectResponse> bulkRejectApplications(
            @PathVariable UUID jobId,
            @RequestBody RejectRequest request,
            HttpServletRequest httpRequest) {

        HeaderContext.assertRecruiter(httpRequest);
        UUID rejectorId = HeaderContext.getAuthUserId(httpRequest);
        UUID orgId = HeaderContext.getOrgId(httpRequest);
        RejectResponse response = applicationService.bulkRejectApplications(
                jobId, request.getApplicationIds(), rejectorId, request.getReason(), orgId);
        return ResponseEntity.ok(response);
    }
}
