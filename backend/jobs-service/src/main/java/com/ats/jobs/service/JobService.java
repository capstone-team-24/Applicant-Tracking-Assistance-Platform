package com.ats.jobs.service;

import com.ats.jobs.dto.*;
import com.ats.jobs.entity.Job;
import com.ats.jobs.enums.JobStatus;
import com.ats.jobs.exception.BadRequestException;
import com.ats.jobs.exception.ForbiddenException;
import com.ats.jobs.exception.ResourceNotFoundException;
import com.ats.jobs.feign.OrgServiceClient;
import com.ats.jobs.repository.JobRepository;
import com.ats.jobs.repository.JobSpec;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class JobService {

    private final JobRepository jobRepository;
    private final OrgServiceClient orgServiceClient;

    @Transactional
    public JobResponse createJob(CreateJobRequest request, UUID userId, UUID orgId) {
        Job job = Job.builder()
                .orgId(orgId)
                .title(request.getTitle())
                .description(request.getDescription())
                .requirements(request.getRequirements())
                .location(request.getLocation())
                .employmentType(request.getEmploymentType())
                .experienceLevel(request.getExperienceLevel())
                .skills(request.getSkills())
                .scoringWeights(request.getScoringWeights())
                .customScoringRules(request.getCustomScoringRules())
                .status(JobStatus.DRAFT)
                .createdBy(userId)
                .assignedTo(userId)
                .applicationDeadline(request.getApplicationDeadline())
                .build();

        Job saved = jobRepository.save(job);
        log.info("Created job id={} for orgId={}", saved.getId(), orgId);
        return mapToResponse(saved);
    }

    @Transactional
    public JobResponse updateJob(UUID id, UpdateJobRequest request, UUID orgId, UUID callerId) {
        Job job = findJobOrThrow(id);
        validateOwnership(job, orgId);
        validateAssignment(job, callerId);

        if (request.getTitle() != null) {
            job.setTitle(request.getTitle());
        }
        if (request.getDescription() != null) {
            job.setDescription(request.getDescription());
        }
        if (request.getRequirements() != null) {
            job.setRequirements(request.getRequirements());
        }
        if (request.getLocation() != null) {
            job.setLocation(request.getLocation());
        }
        if (request.getEmploymentType() != null) {
            job.setEmploymentType(request.getEmploymentType());
        }
        if (request.getExperienceLevel() != null) {
            job.setExperienceLevel(request.getExperienceLevel());
        }
        if (request.getSkills() != null) {
            job.setSkills(request.getSkills());
        }
        if (request.getScoringWeights() != null) {
            job.setScoringWeights(request.getScoringWeights());
        }
        if (request.getCustomScoringRules() != null) {
            job.setCustomScoringRules(request.getCustomScoringRules());
        }
        // applicationDeadline — allow setting, updating, or clearing (null = no deadline)
        if (request.getApplicationDeadline() != null) {
            job.setApplicationDeadline(request.getApplicationDeadline());
        }

        Job saved = jobRepository.save(job);
        log.info("Updated job id={}", saved.getId());
        return mapToResponse(saved);
    }

    @Transactional(readOnly = true)
    public JobResponse getJob(UUID id) {
        Job job = findJobOrThrow(id);
        return mapToResponse(job);
    }

    @Transactional(readOnly = true)
    public JobListResponse listJobs(
            UUID orgId,
            JobStatus status,
            String search,
            String location,
            String employmentType,
            String experienceLevel,
            Pageable pageable) {

        Specification<Job> spec = JobSpec.withFilters(
                orgId, status, search, location, employmentType, experienceLevel);
        Page<Job> page = jobRepository.findAll(spec, pageable);
        return buildListResponse(page);
    }

    /**
     * List jobs scoped to a recruiter's company (orgId mandatory).
     * All company jobs are returned so the recruiter can see the full picture,
     * but only jobs where assignedTo == recruiterId may be mutated (enforced
     * separately by {@link #validateAssignment}).
     */
    @Transactional(readOnly = true)
    public JobListResponse listJobsByOrg(
            UUID orgId,
            JobStatus status,
            String search,
            String location,
            String employmentType,
            String experienceLevel,
            Pageable pageable) {

        // orgId is always forced by the caller for recruiters — never null here
        Specification<Job> spec = JobSpec.withFilters(
                orgId, status, search, location, employmentType, experienceLevel);
        Page<Job> page = jobRepository.findAll(spec, pageable);
        return buildListResponse(page);
    }

    @Transactional
    public JobResponse publishJob(UUID id, UUID orgId, UUID callerId) {
        Job job = findJobOrThrow(id);
        validateOwnership(job, orgId);
        validateAssignment(job, callerId);

        if (job.getStatus() != JobStatus.DRAFT) {
            throw new BadRequestException("Only DRAFT jobs can be published. Current status: " + job.getStatus());
        }

        job.setStatus(JobStatus.PUBLISHED);
        job.setPublishedAt(LocalDateTime.now());
        Job saved = jobRepository.save(job);
        log.info("Published job id={}", saved.getId());
        return mapToResponse(saved);
    }

    @Transactional
    public JobResponse closeJob(UUID id, UUID orgId, UUID callerId) {
        Job job = findJobOrThrow(id);
        validateOwnership(job, orgId);
        validateAssignment(job, callerId);

        if (job.getStatus() != JobStatus.PUBLISHED) {
            throw new BadRequestException("Only PUBLISHED jobs can be closed. Current status: " + job.getStatus());
        }

        job.setStatus(JobStatus.CLOSED);
        job.setClosedAt(LocalDateTime.now());
        Job saved = jobRepository.save(job);
        log.info("Closed job id={}", saved.getId());
        return mapToResponse(saved);
    }

    @Transactional
    public JobResponse archiveJob(UUID id, UUID orgId, UUID callerId) {
        Job job = findJobOrThrow(id);
        validateOwnership(job, orgId);
        validateAssignment(job, callerId);

        if (job.getStatus() != JobStatus.CLOSED) {
            throw new BadRequestException("Only CLOSED jobs can be archived. Current status: " + job.getStatus());
        }

        job.setStatus(JobStatus.ARCHIVED);
        Job saved = jobRepository.save(job);
        log.info("Archived job id={}", saved.getId());
        return mapToResponse(saved);
    }

    @Transactional
    public void deleteJob(UUID id, UUID orgId, UUID callerId) {
        Job job = findJobOrThrow(id);
        validateOwnership(job, orgId);
        validateAssignment(job, callerId);

        if (job.getStatus() != JobStatus.DRAFT) {
            throw new BadRequestException("Only DRAFT jobs can be deleted. Current status: " + job.getStatus());
        }

        jobRepository.delete(job);
        log.info("Deleted job id={}", id);
    }

    @Transactional
    public void suspendJobsByRecruiter(UUID recruiterId, boolean suspend) {
        // Suspend PUBLISHED jobs if suspend = true.
        // If suspend = false, we could reinstate SUSPENDED jobs back to PUBLISHED.
        if (suspend) {
            jobRepository.findByStatus(JobStatus.PUBLISHED, Pageable.unpaged())
                    .stream()
                    .filter(job -> recruiterId.equals(job.getAssignedTo()))
                    .forEach(job -> {
                        job.setStatus(JobStatus.SUSPENDED);
                        jobRepository.save(job);
                        log.info("Suspended job id={} because recruiter {} was suspended", job.getId(), recruiterId);
                    });
        } else {
            jobRepository.findByStatus(JobStatus.SUSPENDED, Pageable.unpaged())
                    .stream()
                    .filter(job -> recruiterId.equals(job.getAssignedTo()))
                    .forEach(job -> {
                        job.setStatus(JobStatus.PUBLISHED);
                        jobRepository.save(job);
                        log.info("Unsuspended job id={} because recruiter {} was reinstated", job.getId(), recruiterId);
                    });
        }
    }

    @Transactional
    public JobResponse reassignJob(UUID jobId, UUID newRecruiterId, UUID orgId) {
        Job job = findJobOrThrow(jobId);
        validateOwnership(job, orgId);

        job.setAssignedTo(newRecruiterId);
        
        if (newRecruiterId == null) {
            // Unassigned -> Suspended
            if (job.getStatus() == JobStatus.PUBLISHED) {
                job.setStatus(JobStatus.SUSPENDED);
            }
        } else {
            // Reassigned to active -> Published
            if (job.getStatus() == JobStatus.SUSPENDED) {
                job.setStatus(JobStatus.PUBLISHED);
            }
        }

        Job saved = jobRepository.save(job);
        log.info("Reassigned job id={} to newRecruiterId={}", jobId, newRecruiterId);
        return mapToResponse(saved);
    }

    private Job findJobOrThrow(UUID id) {
        return jobRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Job not found with id: " + id));
    }

    private void validateOwnership(Job job, UUID orgId) {
        if (orgId == null || !job.getOrgId().equals(orgId)) {
            throw new ForbiddenException("You do not have access to this job.");
        }
    }

    /**
     * Ensures the calling recruiter is the one assigned to this job before
     * allowing any mutation (update, publish, close, archive, delete).
     */
    private void validateAssignment(Job job, UUID callerId) {
        if (callerId == null || !callerId.equals(job.getAssignedTo())) {
            throw new ForbiddenException(
                    "You are not assigned to this job and cannot modify it.");
        }
    }

    private JobListResponse buildListResponse(Page<Job> page) {
        return JobListResponse.builder()
                .content(page.getContent().stream().map(this::mapToResponse).toList())
                .page(page.getNumber())
                .size(page.getSize())
                .totalElements(page.getTotalElements())
                .totalPages(page.getTotalPages())
                .last(page.isLast())
                .build();
    }

    private JobResponse mapToResponse(Job job) {
        String orgName = null;
        if (job.getOrgId() != null) {
            try {
                orgName = orgServiceClient.getOrganizationName(job.getOrgId());
            } catch (Exception e) {
                log.warn("Could not resolve org name for orgId={}: {}", job.getOrgId(), e.getMessage());
            }
        }
        return JobResponse.builder()
                .id(job.getId())
                .orgId(job.getOrgId())
                .organizationName(orgName)
                .title(job.getTitle())
                .description(job.getDescription())
                .requirements(job.getRequirements())
                .location(job.getLocation())
                .employmentType(job.getEmploymentType())
                .experienceLevel(job.getExperienceLevel())
                .skills(job.getSkills())
                .scoringWeights(job.getScoringWeights())
                .customScoringRules(job.getCustomScoringRules())
                .status(job.getStatus())
                .createdBy(job.getCreatedBy())
                .assignedTo(job.getAssignedTo())
                .createdAt(job.getCreatedAt())
                .updatedAt(job.getUpdatedAt())
                .publishedAt(job.getPublishedAt())
                .closedAt(job.getClosedAt())
                .applicationDeadline(job.getApplicationDeadline())
                .build();
    }
}
