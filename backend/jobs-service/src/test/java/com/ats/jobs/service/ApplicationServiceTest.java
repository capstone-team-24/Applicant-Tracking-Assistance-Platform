package com.ats.jobs.service;

import com.ats.jobs.dto.ApplicationResponse;
import com.ats.jobs.dto.CandidateApplicationDetailResponse;
import com.ats.jobs.entity.Application;
import com.ats.jobs.entity.Job;
import com.ats.jobs.enums.ApplicationStatus;
import com.ats.jobs.enums.JobStatus;
import com.ats.jobs.exception.ForbiddenException;
import com.ats.jobs.feign.NotificationServiceClient;
import com.ats.jobs.feign.OrgServiceClient;
import com.ats.jobs.feign.UserServiceClient;
import com.ats.jobs.repository.ApplicationRepository;
import com.ats.jobs.repository.JobRepository;
import com.ats.jobs.util.FileStorageUtil;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.kafka.core.KafkaTemplate;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

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

    @Mock
    private OrgServiceClient orgServiceClient;

    @Mock
    private NotificationServiceClient notificationServiceClient;

    @InjectMocks
    private ApplicationService applicationService;

    @Test
    void getMyApplicationDetail_rejectsAnotherCandidatesApplication() {
        UUID applicationId = UUID.randomUUID();
        UUID ownerId = UUID.randomUUID();
        UUID requesterId = UUID.randomUUID();

        Application application = Application.builder()
                .id(applicationId)
                .jobId(UUID.randomUUID())
                .candidateAuthUserId(ownerId)
                .status(ApplicationStatus.APPLIED)
                .build();

        when(applicationRepository.findById(applicationId)).thenReturn(Optional.of(application));

        assertThrows(
                ForbiddenException.class,
                () -> applicationService.getMyApplicationDetail(applicationId, requesterId)
        );
    }

    @Test
    void listMyApplications_omitsRecruiterOnlyFields() {
        UUID candidateId = UUID.randomUUID();
        UUID jobId = UUID.randomUUID();
        UUID orgId = UUID.randomUUID();
        UUID recruiterId = UUID.randomUUID();

        Application application = Application.builder()
                .id(UUID.randomUUID())
                .jobId(jobId)
                .candidateAuthUserId(candidateId)
                .candidateName("John Smith")
                .candidateEmail("john@example.com")
                .status(ApplicationStatus.REJECTED)
                .compositeScore(88.5)
                .oaScore(91.0)
                .interviewScore(72.0)
                .rankingPosition(2)
                .finalRank(1)
                .rejectionReason("Role closed")
                .rejectedAt(LocalDateTime.of(2026, 5, 30, 14, 0))
                .createdAt(LocalDateTime.of(2026, 5, 20, 9, 30))
                .build();

        Job job = Job.builder()
                .id(jobId)
                .orgId(orgId)
                .title("Backend Engineer")
                .description("Build APIs")
                .requirements("Spring Boot")
                .location("Remote")
                .employmentType("FULL_TIME")
                .experienceLevel("MID")
                .skills(List.of("Java", "Spring"))
                .status(JobStatus.PUBLISHED)
                .createdBy(recruiterId)
                .assignedTo(recruiterId)
                .createdAt(LocalDateTime.of(2026, 5, 1, 8, 0))
                .updatedAt(LocalDateTime.of(2026, 5, 2, 8, 0))
                .build();

        when(applicationRepository.findByCandidateAuthUserId(eq(candidateId), any(PageRequest.class)))
                .thenReturn(new PageImpl<>(List.of(application)));
        when(jobRepository.findById(jobId)).thenReturn(Optional.of(job));
        when(orgServiceClient.getOrganizationName(orgId)).thenReturn("Acme");

        Page<ApplicationResponse> result =
                applicationService.listMyApplications(candidateId, PageRequest.of(0, 20));

        ApplicationResponse payload = result.getContent().get(0);
        assertThat(payload.getStatus()).isEqualTo(ApplicationStatus.REJECTED);
        assertThat(payload.getRejectionReason()).isEqualTo("Role closed");
        assertThat(payload.getCompositeScore()).isNull();
        assertThat(payload.getOaScore()).isNull();
        assertThat(payload.getInterviewScore()).isNull();
        assertThat(payload.getRankingPosition()).isNull();
        assertThat(payload.getFinalRank()).isNull();
        assertThat(payload.getJob()).isNotNull();
        assertThat(payload.getJob().getOrganizationName()).isEqualTo("Acme");
        assertThat(payload.getJob().getAssignedTo()).isNull();
        assertThat(payload.getJob().getAssignedRecruiterIds()).isNull();
        assertThat(payload.getCandidateEmail()).isEqualTo("john@example.com");
    }

    @Test
    void getMyApplicationDetail_returnsCandidateSafeFields() {
        UUID applicationId = UUID.randomUUID();
        UUID candidateId = UUID.randomUUID();
        UUID jobId = UUID.randomUUID();
        UUID orgId = UUID.randomUUID();

        Application application = Application.builder()
                .id(applicationId)
                .jobId(jobId)
                .candidateAuthUserId(candidateId)
                .candidateName("John Smith")
                .candidateEmail("john@example.com")
                .contactPhone("+1-555-0100")
                .coverLetter("Excited to apply.")
                .candidateProfileSnapshot(Map.of("fullName", "John Smith"))
                .originalFilename("resume.pdf")
                .status(ApplicationStatus.APPLIED)
                .createdAt(LocalDateTime.of(2026, 5, 20, 9, 30))
                .updatedAt(LocalDateTime.of(2026, 5, 21, 10, 0))
                .build();

        Job job = Job.builder()
                .id(jobId)
                .orgId(orgId)
                .title("Backend Engineer")
                .description("Build APIs")
                .requirements("Spring Boot")
                .location("Remote")
                .employmentType("FULL_TIME")
                .experienceLevel("MID")
                .skills(List.of("Java"))
                .status(JobStatus.PUBLISHED)
                .createdBy(UUID.randomUUID())
                .createdAt(LocalDateTime.of(2026, 5, 1, 8, 0))
                .updatedAt(LocalDateTime.of(2026, 5, 2, 8, 0))
                .build();

        when(applicationRepository.findById(applicationId)).thenReturn(Optional.of(application));
        when(jobRepository.findById(jobId)).thenReturn(Optional.of(job));
        when(orgServiceClient.getOrganizationName(orgId)).thenReturn("Acme");

        CandidateApplicationDetailResponse result =
                applicationService.getMyApplicationDetail(applicationId, candidateId);

        assertThat(result.getOriginalFilename()).isEqualTo("resume.pdf");
        assertThat(result.getCandidateProfileSnapshot()).containsEntry("fullName", "John Smith");
        assertThat(result.getJob()).isNotNull();
        assertThat(result.getJob().getTitle()).isEqualTo("Backend Engineer");
        assertThat(result.getJob().getAssignedTo()).isNull();
        assertThat(result.getJob().getAssignedRecruiterIds()).isNull();
    }
}
