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

import java.util.ArrayList;
import java.util.List;
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
        UUID orgId  = HeaderContext.getOrgId(httpRequest);

        JobResponse response = jobService.createJob(request, userId, orgId);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    /**
     * List jobs.
     * <ul>
     *   <li>RECRUITER – always scoped to their own org and assigned recruiter id.
     *       Any orgId query-param supplied by the client is ignored.</li>
     *   <li>ORG_ADMIN / PLATFORM_ADMIN – can pass orgId freely.</li>
     * </ul>
     */
    @GetMapping
    public ResponseEntity<JobListResponse> listJobs(
            @RequestParam(required = false) UUID orgId,
            @RequestParam(required = false) JobStatus status,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String location,
            @RequestParam(required = false) String employmentType,
            @RequestParam(required = false) String experienceLevel,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir,
            HttpServletRequest httpRequest) {

        Sort sort = sortDir.equalsIgnoreCase("asc")
                ? Sort.by(sortBy).ascending()
                : Sort.by(sortBy).descending();
        Pageable pageable = PageRequest.of(page, size, sort);

        String role = HeaderContext.getUserRole(httpRequest);

        JobListResponse response;
        if ("RECRUITER".equalsIgnoreCase(role)) {
            // Force orgId from the auth headers – recruiter cannot see other companies
            UUID recruiterOrgId = HeaderContext.getOrgId(httpRequest);
            UUID recruiterId = HeaderContext.getUserId(httpRequest);
            response = jobService.listJobsByOrg(
                    recruiterOrgId, recruiterId, status, search, location, employmentType, experienceLevel, pageable);
        } else {
            response = jobService.listJobs(
                    orgId, status, search, location, employmentType, experienceLevel, pageable);
        }

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
        UUID userId = HeaderContext.getUserId(httpRequest);
        UUID orgId  = HeaderContext.getOrgId(httpRequest);

        JobResponse response = jobService.updateJob(id, request, orgId, userId);
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteJob(
            @PathVariable UUID id,
            HttpServletRequest httpRequest) {

        HeaderContext.assertRecruiter(httpRequest);
        UUID userId = HeaderContext.getUserId(httpRequest);
        UUID orgId  = HeaderContext.getOrgId(httpRequest);

        jobService.deleteJob(id, orgId, userId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/publish")
    public ResponseEntity<JobResponse> publishJob(
            @PathVariable UUID id,
            HttpServletRequest httpRequest) {

        HeaderContext.assertRecruiter(httpRequest);
        UUID userId = HeaderContext.getUserId(httpRequest);
        UUID orgId  = HeaderContext.getOrgId(httpRequest);

        JobResponse response = jobService.publishJob(id, orgId, userId);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/{id}/close")
    public ResponseEntity<JobResponse> closeJob(
            @PathVariable UUID id,
            HttpServletRequest httpRequest) {

        HeaderContext.assertRecruiter(httpRequest);
        UUID userId = HeaderContext.getUserId(httpRequest);
        UUID orgId  = HeaderContext.getOrgId(httpRequest);

        JobResponse response = jobService.closeJob(id, orgId, userId);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/{id}/archive")
    public ResponseEntity<JobResponse> archiveJob(
            @PathVariable UUID id,
            HttpServletRequest httpRequest) {

        HeaderContext.assertRecruiter(httpRequest);
        UUID userId = HeaderContext.getUserId(httpRequest);
        UUID orgId  = HeaderContext.getOrgId(httpRequest);

        JobResponse response = jobService.archiveJob(id, orgId, userId);
        return ResponseEntity.ok(response);
    }

    @PutMapping("/{id}/reassign")
    public ResponseEntity<JobResponse> reassignJob(
            @PathVariable UUID id,
            @RequestBody Map<String, Object> request,
            HttpServletRequest httpRequest) {

        // Note: Org admins perform this action. We verify orgId only.
        UUID orgId = HeaderContext.getOrgId(httpRequest);

        JobResponse response = jobService.reassignJob(id, parseRecruiterIds(request), orgId);
        return ResponseEntity.ok(response);
    }

    private List<UUID> parseRecruiterIds(Map<String, Object> request) {
        List<UUID> recruiterIds = new ArrayList<>();

        Object assignedRecruiterIds = request.get("assignedRecruiterIds");
        if (assignedRecruiterIds instanceof List<?> rawList) {
            for (Object raw : rawList) {
                if (raw == null) continue;
                String value = raw.toString();
                if (!value.isBlank()) {
                    recruiterIds.add(UUID.fromString(value));
                }
            }
            return recruiterIds;
        }

        Object assignedTo = request.get("assignedTo");
        if (assignedTo != null && !assignedTo.toString().isBlank()) {
            recruiterIds.add(UUID.fromString(assignedTo.toString()));
        }
        return recruiterIds;
    }
}
