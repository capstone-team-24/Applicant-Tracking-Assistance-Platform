package com.ats.jobs.service;

import com.ats.jobs.dto.ApplicationDataResponse;
import com.ats.jobs.dto.ApplicationResponse;
import com.ats.jobs.dto.ApplyRequest;
import com.ats.jobs.entity.Application;
import com.ats.jobs.entity.Job;
import com.ats.jobs.enums.ApplicationStatus;
import com.ats.jobs.enums.JobStatus;
import com.ats.jobs.exception.BadRequestException;
import com.ats.jobs.exception.ResourceNotFoundException;
import com.ats.jobs.feign.UserServiceClient;
import com.ats.jobs.repository.ApplicationRepository;
import com.ats.jobs.repository.JobRepository;
import com.ats.jobs.util.FileStorageUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.mock.web.MockMultipartFile;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ApplicationServiceTest {

    @Mock
    private ApplicationRepository applicationRepository;

    @Mock
    private JobRepository jobRepository;

    @Mock
    private UserServiceClient userServiceClient;

    @Mock
    private FileStorageUtil fileStorageUtil;

    @Mock
    private KafkaTemplate<String, Object> kafkaTemplate;

    @InjectMocks
    private ApplicationService applicationService;

    private UUID jobId;
    private UUID orgId;
    private UUID candidateUserId;
    private Job publishedJob;

    @BeforeEach
    void setUp() {
        jobId = UUID.randomUUID();
        orgId = UUID.randomUUID();
        candidateUserId = UUID.randomUUID();

        publishedJob = Job.builder()
                .id(jobId)
                .orgId(orgId)
                .title("Java Developer")
                .status(JobStatus.PUBLISHED)
                .createdBy(UUID.randomUUID())
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();
    }

    @Test
    void apply_shouldCreateApplicationSuccessfully() throws IOException {
        ApplyRequest request = ApplyRequest.builder()
                .candidateAuthUserId(candidateUserId)
                .coverLetter("I am interested in this position")
                .contactPhone("+1234567890")
                .useProfileData(true)
                .build();

        MockMultipartFile file = new MockMultipartFile(
                "file", "resume.pdf", "application/pdf", "PDF content".getBytes());

        ApplicationDataResponse profileData = ApplicationDataResponse.builder()
                .firstName("John")
                .lastName("Doe")
                .email("john@example.com")
                .phone("+1234567890")
                .latestCvUrl("/data/storage/test/cv.pdf")
                .yearsOfExperience(5)
                .build();

        when(jobRepository.findById(jobId)).thenReturn(Optional.of(publishedJob));
        when(userServiceClient.getApplicationData(candidateUserId)).thenReturn(profileData);
        when(fileStorageUtil.storeFile(any(), any(), any())).thenReturn("/data/storage/test/resume.pdf");
        when(applicationRepository.save(any(Application.class))).thenAnswer(invocation -> {
            Application app = invocation.getArgument(0);
            app.setCreatedAt(LocalDateTime.now());
            app.setUpdatedAt(LocalDateTime.now());
            return app;
        });

        ApplicationResponse response = applicationService.apply(jobId, request, file, orgId, candidateUserId);

        assertThat(response).isNotNull();
        assertThat(response.getJobId()).isEqualTo(jobId);
        assertThat(response.getStatus()).isEqualTo(ApplicationStatus.APPLIED);
        assertThat(response.getCandidateName()).isEqualTo("John Doe");
        assertThat(response.getCandidateEmail()).isEqualTo("john@example.com");

        verify(jobRepository).findById(jobId);
        verify(userServiceClient).getApplicationData(candidateUserId);
        verify(fileStorageUtil).storeFile(any(), eq(orgId), any());
        verify(applicationRepository).save(any(Application.class));
        // specify Object.class for the third argument matcher to avoid overload ambiguity
        verify(kafkaTemplate).send(eq("application.submitted"), any(Object.class));
    }

    @Test
    void apply_shouldFailForNonPublishedJob() {
        Job draftJob = Job.builder()
                .id(jobId)
                .orgId(orgId)
                .title("Java Developer")
                .status(JobStatus.DRAFT)
                .createdBy(UUID.randomUUID())
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();

        when(jobRepository.findById(jobId)).thenReturn(Optional.of(draftJob));

        ApplyRequest request = ApplyRequest.builder()
                .candidateAuthUserId(candidateUserId)
                .build();

        assertThatThrownBy(() -> applicationService.apply(jobId, request, null, orgId, candidateUserId))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Applications can only be submitted for PUBLISHED jobs");
    }

    @Test
    void apply_shouldFailForNonExistentJob() {
        when(jobRepository.findById(jobId)).thenReturn(Optional.empty());

        ApplyRequest request = ApplyRequest.builder()
                .candidateAuthUserId(candidateUserId)
                .build();

        assertThatThrownBy(() -> applicationService.apply(jobId, request, null, orgId, candidateUserId))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("Job not found");
    }

    @Test
    void apply_shouldWorkWithoutProfileDataFetch() throws IOException {
        ApplyRequest request = ApplyRequest.builder()
                .candidateAuthUserId(candidateUserId)
                .coverLetter("Cover letter")
                .useProfileData(false)
                .build();

        when(jobRepository.findById(jobId)).thenReturn(Optional.of(publishedJob));
        when(applicationRepository.save(any(Application.class))).thenAnswer(invocation -> {
            Application app = invocation.getArgument(0);
            app.setCreatedAt(LocalDateTime.now());
            app.setUpdatedAt(LocalDateTime.now());
            return app;
        });

        ApplicationResponse response = applicationService.apply(jobId, request, null, orgId, candidateUserId);

        assertThat(response).isNotNull();
        assertThat(response.getStatus()).isEqualTo(ApplicationStatus.APPLIED);

        verify(userServiceClient, never()).getApplicationData(any());
    }
}
