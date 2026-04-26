package com.ats.jobs.service;

import com.ats.jobs.dto.*;
import com.ats.jobs.entity.Job;
import com.ats.jobs.enums.JobStatus;
import com.ats.jobs.exception.BadRequestException;
import com.ats.jobs.exception.ForbiddenException;
import com.ats.jobs.exception.ResourceNotFoundException;
import com.ats.jobs.repository.JobRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class JobService {

    private final JobRepository jobRepository;

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
                .build();

        Job saved = jobRepository.save(job);
        log.info("Created job id={} for orgId={}", saved.getId(), orgId);
        return mapToResponse(saved);
    }

    @Transactional
    public JobResponse updateJob(UUID id, UpdateJobRequest request, UUID orgId) {
        Job job = findJobOrThrow(id);
        validateOwnership(job, orgId);

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
    public JobListResponse listJobs(UUID orgId, JobStatus status, Pageable pageable) {
        Page<Job> page;
        if (orgId != null && status != null) {
            page = jobRepository.findByOrgIdAndStatus(orgId, status, pageable);
        } else if (orgId != null) {
            page = jobRepository.findByOrgId(orgId, pageable);
        } else if (status != null) {
            page = jobRepository.findByStatus(status, pageable);
        } else {
            page = jobRepository.findAll(pageable);
        }

        return JobListResponse.builder()
                .content(page.getContent().stream().map(this::mapToResponse).toList())
                .page(page.getNumber())
                .size(page.getSize())
                .totalElements(page.getTotalElements())
                .totalPages(page.getTotalPages())
                .last(page.isLast())
                .build();
    }

    @Transactional
    public JobResponse publishJob(UUID id, UUID orgId) {
        Job job = findJobOrThrow(id);
        validateOwnership(job, orgId);

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
    public JobResponse closeJob(UUID id, UUID orgId) {
        Job job = findJobOrThrow(id);
        validateOwnership(job, orgId);

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
    public JobResponse archiveJob(UUID id, UUID orgId) {
        Job job = findJobOrThrow(id);
        validateOwnership(job, orgId);

        if (job.getStatus() != JobStatus.CLOSED) {
            throw new BadRequestException("Only CLOSED jobs can be archived. Current status: " + job.getStatus());
        }

        job.setStatus(JobStatus.ARCHIVED);
        Job saved = jobRepository.save(job);
        log.info("Archived job id={}", saved.getId());
        return mapToResponse(saved);
    }

    @Transactional
    public void deleteJob(UUID id, UUID orgId) {
        Job job = findJobOrThrow(id);
        validateOwnership(job, orgId);

        if (job.getStatus() != JobStatus.DRAFT) {
            throw new BadRequestException("Only DRAFT jobs can be deleted. Current status: " + job.getStatus());
        }

        jobRepository.delete(job);
        log.info("Deleted job id={}", id);
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

    private JobResponse mapToResponse(Job job) {
        return JobResponse.builder()
                .id(job.getId())
                .orgId(job.getOrgId())
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
                .createdAt(job.getCreatedAt())
                .updatedAt(job.getUpdatedAt())
                .publishedAt(job.getPublishedAt())
                .closedAt(job.getClosedAt())
                .build();
    }
}
