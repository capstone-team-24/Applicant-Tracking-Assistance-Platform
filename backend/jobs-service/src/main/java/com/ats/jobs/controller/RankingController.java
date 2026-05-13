package com.ats.jobs.controller;

import com.ats.jobs.dto.RankingJobResponse;
import com.ats.jobs.dto.RejectResponse;
import com.ats.jobs.dto.SendAssessmentRequest;
import com.ats.jobs.dto.SendAssessmentResponse;
import com.ats.jobs.dto.SendInterviewInviteRequest;
import com.ats.jobs.dto.SendInterviewInviteResponse;
import com.ats.jobs.service.AssessmentInviteService;
import com.ats.jobs.service.InterviewInviteService;
import com.ats.jobs.service.RankingService;
import com.ats.jobs.util.HeaderContext;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/jobs")
@RequiredArgsConstructor
public class RankingController {

    private final RankingService rankingService;
    private final AssessmentInviteService assessmentInviteService;
    private final InterviewInviteService interviewInviteService;

    @PostMapping("/{id}/rank")
    public ResponseEntity<RankingJobResponse> triggerRanking(
            @PathVariable UUID id,
            HttpServletRequest httpRequest) {

        HeaderContext.assertRecruiter(httpRequest);
        UUID orgId = HeaderContext.getOrgId(httpRequest);
        RankingJobResponse response = rankingService.triggerRanking(id, orgId);
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(response);
    }

    @GetMapping("/ranking/{rankingJobId}")
    public ResponseEntity<RankingJobResponse> getRankingStatus(@PathVariable UUID rankingJobId) {
        RankingJobResponse response = rankingService.getRankingStatus(rankingJobId);
        return ResponseEntity.ok(response);
    }

    /** POST /api/v1/jobs/{jobId}/send-assessment */
    @PostMapping("/{jobId}/send-assessment")
    public ResponseEntity<SendAssessmentResponse> sendAssessmentInvites(
            @PathVariable UUID jobId,
            @RequestBody SendAssessmentRequest request,
            HttpServletRequest httpRequest) {

        HeaderContext.assertRecruiter(httpRequest);
        UUID orgId = HeaderContext.getOrgId(httpRequest);
        SendAssessmentResponse response =
                assessmentInviteService.sendAssessmentToTopCandidates(jobId, request, orgId);
        return ResponseEntity.ok(response);
    }

    /** POST /api/v1/jobs/{jobId}/send-interview-invites */
    @PostMapping("/{jobId}/send-interview-invites")
    public ResponseEntity<SendInterviewInviteResponse> sendInterviewInvites(
            @PathVariable UUID jobId,
            @RequestBody SendInterviewInviteRequest request,
            HttpServletRequest httpRequest) {

        HeaderContext.assertRecruiter(httpRequest);
        UUID orgId = HeaderContext.getOrgId(httpRequest);
        SendInterviewInviteResponse response =
                interviewInviteService.sendInterviewInvites(jobId, request, orgId);
        return ResponseEntity.ok(response);
    }

    /** POST /api/v1/jobs/{jobId}/reject-uninvited */
    @PostMapping("/{jobId}/reject-uninvited")
    public ResponseEntity<RejectResponse> rejectUninvitedCandidates(
            @PathVariable UUID jobId,
            HttpServletRequest httpRequest) {

        HeaderContext.assertRecruiter(httpRequest);
        UUID orgId = HeaderContext.getOrgId(httpRequest);
        RejectResponse response = assessmentInviteService.rejectUninvitedCandidates(jobId, orgId);
        return ResponseEntity.ok(response);
    }

    /** POST /api/v1/jobs/{jobId}/reject-uninvited-interview */
    @PostMapping("/{jobId}/reject-uninvited-interview")
    public ResponseEntity<RejectResponse> rejectUninvitedInterviewCandidates(
            @PathVariable UUID jobId,
            HttpServletRequest httpRequest) {

        HeaderContext.assertRecruiter(httpRequest);
        UUID orgId = HeaderContext.getOrgId(httpRequest);
        RejectResponse response = interviewInviteService.rejectUninvitedCandidates(jobId, orgId);
        return ResponseEntity.ok(response);
    }

    /** PUT /api/v1/jobs/{jobId}/assessment-deadline */
    @PutMapping("/{jobId}/assessment-deadline")
    public ResponseEntity<Void> updateAssessmentDeadline(
            @PathVariable UUID jobId,
            @RequestBody DeadlineUpdateRequest request,
            HttpServletRequest httpRequest) {

        HeaderContext.assertRecruiter(httpRequest);
        assessmentInviteService.updateDeadlineForJob(jobId, request.getNewDeadline());
        return ResponseEntity.ok().build();
    }

    /** PUT /api/v1/jobs/{jobId}/interview-deadline */
    @PutMapping("/{jobId}/interview-deadline")
    public ResponseEntity<Void> updateInterviewDeadline(
            @PathVariable UUID jobId,
            @RequestBody DeadlineUpdateRequest request,
            HttpServletRequest httpRequest) {

        HeaderContext.assertRecruiter(httpRequest);
        interviewInviteService.updateDeadlineForJob(jobId, request.getNewDeadline());
        return ResponseEntity.ok().build();
    }

    /**
     * Simple DTO for deadline update requests.
     */
    public static class DeadlineUpdateRequest {
        private LocalDateTime newDeadline;

        public LocalDateTime getNewDeadline() {
            return newDeadline;
        }

        public void setNewDeadline(LocalDateTime newDeadline) {
            this.newDeadline = newDeadline;
        }
    }
}
