package com.ats.jobs.service;

import com.ats.jobs.dto.CreateJobRequest;
import com.ats.jobs.dto.JobResponse;
import com.ats.jobs.entity.Job;
import com.ats.jobs.enums.JobStatus;
import com.ats.jobs.exception.BadRequestException;
import com.ats.jobs.exception.ForbiddenException;
import com.ats.jobs.repository.JobRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class JobServiceTest {

    @Mock
    private JobRepository jobRepository;

    @InjectMocks
    private JobService jobService;

    private UUID userId;
    private UUID orgId;
    private UUID jobId;

    @BeforeEach
    void setUp() {
        userId = UUID.randomUUID();
        orgId = UUID.randomUUID();
        jobId = UUID.randomUUID();
    }

    @Test
    void createJob_shouldCreateWithDraftStatus() {
        CreateJobRequest request = CreateJobRequest.builder()
                .title("Senior Java Developer")
                .description("Looking for an experienced Java developer")
                .requirements("5+ years of experience")
                .location("Remote")
                .employmentType("FULL_TIME")
                .experienceLevel("SENIOR")
                .skills(List.of("Java", "Spring Boot", "PostgreSQL"))
                .build();

        Job savedJob = Job.builder()
                .id(jobId)
                .orgId(orgId)
                .title(request.getTitle())
                .description(request.getDescription())
                .requirements(request.getRequirements())
                .location(request.getLocation())
                .employmentType(request.getEmploymentType())
                .experienceLevel(request.getExperienceLevel())
                .skills(request.getSkills())
                .status(JobStatus.DRAFT)
                .createdBy(userId)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();

        when(jobRepository.save(any(Job.class))).thenReturn(savedJob);

        JobResponse response = jobService.createJob(request, userId, orgId);

        assertThat(response).isNotNull();
        assertThat(response.getId()).isEqualTo(jobId);
        assertThat(response.getTitle()).isEqualTo("Senior Java Developer");
        assertThat(response.getStatus()).isEqualTo(JobStatus.DRAFT);
        assertThat(response.getOrgId()).isEqualTo(orgId);
        assertThat(response.getCreatedBy()).isEqualTo(userId);

        ArgumentCaptor<Job> jobCaptor = ArgumentCaptor.forClass(Job.class);
        verify(jobRepository).save(jobCaptor.capture());
        Job capturedJob = jobCaptor.getValue();
        assertThat(capturedJob.getStatus()).isEqualTo(JobStatus.DRAFT);
        assertThat(capturedJob.getOrgId()).isEqualTo(orgId);
    }

    @Test
    void publishJob_shouldSetPublishedStatusAndTimestamp() {
        Job draftJob = Job.builder()
                .id(jobId)
                .orgId(orgId)
                .title("Test Job")
                .status(JobStatus.DRAFT)
                .createdBy(userId)
                .assignedTo(userId)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();

        Job publishedJob = Job.builder()
                .id(jobId)
                .orgId(orgId)
                .title("Test Job")
                .status(JobStatus.PUBLISHED)
                .createdBy(userId)
                .assignedTo(userId)
                .createdAt(draftJob.getCreatedAt())
                .updatedAt(LocalDateTime.now())
                .publishedAt(LocalDateTime.now())
                .build();

        when(jobRepository.findById(jobId)).thenReturn(Optional.of(draftJob));
        when(jobRepository.save(any(Job.class))).thenReturn(publishedJob);

        JobResponse response = jobService.publishJob(jobId, orgId, userId);

        assertThat(response).isNotNull();
        assertThat(response.getStatus()).isEqualTo(JobStatus.PUBLISHED);
        assertThat(response.getPublishedAt()).isNotNull();

        verify(jobRepository).findById(jobId);
        verify(jobRepository).save(any(Job.class));
    }

    @Test
    void publishJob_shouldFailWhenNotDraft() {
        Job publishedJob = Job.builder()
                .id(jobId)
                .orgId(orgId)
                .title("Test Job")
                .status(JobStatus.PUBLISHED)
                .createdBy(userId)
                .assignedTo(userId)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();

        when(jobRepository.findById(jobId)).thenReturn(Optional.of(publishedJob));

        assertThatThrownBy(() -> jobService.publishJob(jobId, orgId, userId))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Only DRAFT jobs can be published");
    }

    @Test
    void publishJob_shouldFailWithWrongOrgId() {
        UUID differentOrgId = UUID.randomUUID();

        Job draftJob = Job.builder()
                .id(jobId)
                .orgId(orgId)
                .title("Test Job")
                .status(JobStatus.DRAFT)
                .createdBy(userId)
                .assignedTo(userId)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();

        when(jobRepository.findById(jobId)).thenReturn(Optional.of(draftJob));

        assertThatThrownBy(() -> jobService.publishJob(jobId, differentOrgId, userId))
                .isInstanceOf(ForbiddenException.class)
                .hasMessageContaining("You do not have access to this job");
    }

    @Test
    void deleteJob_shouldOnlyDeleteDraftJobs() {
        Job draftJob = Job.builder()
                .id(jobId)
                .orgId(orgId)
                .title("Test Job")
                .status(JobStatus.DRAFT)
                .createdBy(userId)
                .assignedTo(userId)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();

        when(jobRepository.findById(jobId)).thenReturn(Optional.of(draftJob));

        jobService.deleteJob(jobId, orgId, userId);

        verify(jobRepository).delete(draftJob);
    }

    @Test
    void deleteJob_shouldFailWhenNotDraft() {
        Job publishedJob = Job.builder()
                .id(jobId)
                .orgId(orgId)
                .title("Test Job")
                .status(JobStatus.PUBLISHED)
                .createdBy(userId)
                .assignedTo(userId)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();

        when(jobRepository.findById(jobId)).thenReturn(Optional.of(publishedJob));

        assertThatThrownBy(() -> jobService.deleteJob(jobId, orgId, userId))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Only DRAFT jobs can be deleted");
    }
}
