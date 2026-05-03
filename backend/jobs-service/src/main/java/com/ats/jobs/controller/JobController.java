package com.ats.jobs.controller;

import com.ats.jobs.dto.*;
import com.ats.jobs.enums.JobStatus;
import com.ats.jobs.service.JobService;
import com.ats.jobs.util.HeaderContext;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/jobs")
@RequiredArgsConstructor
public class JobController {

    private final JobService jobService;

    @PostMapping
    public ResponseEntity<JobResponse> createJob(
            @Valid @RequestBody CreateJobRequest request,
            HttpServletRequest httpRequest) {

        HeaderContext.assertRecruiter(httpRequest);
        UUID userId = HeaderContext.getUserId(httpRequest);
        UUID orgId = HeaderContext.getOrgId(httpRequest);

        JobResponse response = jobService.createJob(request, userId, orgId);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping
    public ResponseEntity<JobListResponse> listJobs(
            @RequestParam(required = false) UUID orgId,
            @RequestParam(required = false) JobStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir) {

        Sort sort = sortDir.equalsIgnoreCase("asc")
                ? Sort.by(sortBy).ascending()
                : Sort.by(sortBy).descending();
        Pageable pageable = PageRequest.of(page, size, sort);

        JobListResponse response = jobService.listJobs(orgId, status, pageable);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{id}")
    public ResponseEntity<JobResponse> getJob(@PathVariable UUID id) {
        JobResponse response = jobService.getJob(id);
        return ResponseEntity.ok(response);
    }

    @PutMapping("/{id}")
    public ResponseEntity<JobResponse> updateJob(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateJobRequest request,
            HttpServletRequest httpRequest) {

        HeaderContext.assertRecruiter(httpRequest);
        UUID orgId = HeaderContext.getOrgId(httpRequest);

        JobResponse response = jobService.updateJob(id, request, orgId);
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteJob(
            @PathVariable UUID id,
            HttpServletRequest httpRequest) {

        HeaderContext.assertRecruiter(httpRequest);
        UUID orgId = HeaderContext.getOrgId(httpRequest);

        jobService.deleteJob(id, orgId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/publish")
    public ResponseEntity<JobResponse> publishJob(
            @PathVariable UUID id,
            HttpServletRequest httpRequest) {

        HeaderContext.assertRecruiter(httpRequest);
        UUID orgId = HeaderContext.getOrgId(httpRequest);

        JobResponse response = jobService.publishJob(id, orgId);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/{id}/close")
    public ResponseEntity<JobResponse> closeJob(
            @PathVariable UUID id,
            HttpServletRequest httpRequest) {

        HeaderContext.assertRecruiter(httpRequest);
        UUID orgId = HeaderContext.getOrgId(httpRequest);

        JobResponse response = jobService.closeJob(id, orgId);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/{id}/archive")
    public ResponseEntity<JobResponse> archiveJob(
            @PathVariable UUID id,
            HttpServletRequest httpRequest) {

        HeaderContext.assertRecruiter(httpRequest);
        UUID orgId = HeaderContext.getOrgId(httpRequest);

        JobResponse response = jobService.archiveJob(id, orgId);
        return ResponseEntity.ok(response);
    }

    @PutMapping("/{id}/reassign")
    public ResponseEntity<JobResponse> reassignJob(
            @PathVariable UUID id,
            @RequestBody Map<String, String> request,
            HttpServletRequest httpRequest) {

        // Note: Orgs admins are doing this. We'll verify orgId.
        UUID orgId = HeaderContext.getOrgId(httpRequest);
        String assignedToRaw = request.get("assignedTo");
        UUID newRecruiterId = (assignedToRaw != null && !assignedToRaw.isBlank()) ? UUID.fromString(assignedToRaw) : null;

        JobResponse response = jobService.reassignJob(id, newRecruiterId, orgId);
        return ResponseEntity.ok(response);
    }
}
