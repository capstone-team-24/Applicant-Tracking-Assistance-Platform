package com.ats.jobs.service;

import com.ats.jobs.dto.AssessmentDisqualificationNotificationResponse;
import com.ats.jobs.dto.AssessmentDisqualificationRequest;
import com.ats.jobs.dto.NotificationResponse;
import com.ats.jobs.entity.Application;
import com.ats.jobs.entity.AssessmentInvite;
import com.ats.jobs.entity.Job;
import com.ats.jobs.enums.ApplicationStatus;
import com.ats.jobs.feign.NotificationServiceClient;
import com.ats.jobs.feign.OrgServiceClient;
import com.ats.jobs.feign.UserServiceClient;
import com.ats.jobs.repository.ApplicationRepository;
import com.ats.jobs.repository.AssessmentInviteRepository;
import com.ats.jobs.repository.JobRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AssessmentInviteServiceTest {

    @Mock
    private ApplicationRepository applicationRepository;

    @Mock
    private JobRepository jobRepository;

    @Mock
    private NotificationServiceClient notificationServiceClient;

    @Mock
    private AssessmentInviteRepository assessmentInviteRepository;

    @Mock
    private OrgServiceClient orgServiceClient;

    @Mock
    private UserServiceClient userServiceClient;

    @Mock
    private RestTemplate restTemplate;

    @InjectMocks
    private AssessmentInviteService assessmentInviteService;

    private UUID jobId;
    private UUID candidateId;
    private String assessmentToken;

    @BeforeEach
    void setUp() {
        jobId = UUID.randomUUID();
        candidateId = UUID.randomUUID();
        assessmentToken = "oa-token";
        ReflectionTestUtils.setField(assessmentInviteService, "frontendUrl", "http://localhost:3000");
        ReflectionTestUtils.setField(assessmentInviteService, "assessmentServiceUrl", "http://localhost:8091");
        ReflectionTestUtils.setField(assessmentInviteService, "internalServiceToken", "dev-internal-token");
    }

    @Test
    void notifyAssessmentDisqualification_marksEveryEligibleApplicationDisqualified() {
        AssessmentDisqualificationRequest request = AssessmentDisqualificationRequest.builder()
                .assessmentToken(assessmentToken)
                .jobId(jobId)
                .candidateAuthUserId(candidateId)
                .strikeCount(3)
                .build();

        AssessmentInvite invite = AssessmentInvite.builder()
                .id(UUID.randomUUID())
                .jobId(jobId)
                .candidateAuthUserId(candidateId)
                .candidateEmail("candidate@example.com")
                .jobTitle("Backend Engineer")
                .assessmentToken(assessmentToken)
                .assessmentTitle("Backend OA")
                .sentByEmail("recruiter@example.com")
                .sentAt(LocalDateTime.now())
                .build();

        Application invitedApplication = Application.builder()
                .id(UUID.randomUUID())
                .jobId(jobId)
                .candidateAuthUserId(candidateId)
                .candidateEmail("candidate@example.com")
                .candidateName("Test Candidate")
                .status(ApplicationStatus.OA_INVITED)
                .build();

        Application completedApplication = Application.builder()
                .id(UUID.randomUUID())
                .jobId(jobId)
                .candidateAuthUserId(candidateId)
                .candidateEmail("candidate@example.com")
                .candidateName("Test Candidate")
                .status(ApplicationStatus.OA_COMPLETED)
                .build();

        Application interviewApplication = Application.builder()
                .id(UUID.randomUUID())
                .jobId(jobId)
                .candidateAuthUserId(candidateId)
                .candidateEmail("candidate@example.com")
                .candidateName("Test Candidate")
                .status(ApplicationStatus.INTERVIEW_INVITED)
                .build();

        Job job = Job.builder()
                .id(jobId)
                .orgId(UUID.randomUUID())
                .title("Backend Engineer")
                .build();

        when(assessmentInviteRepository.findFirstByAssessmentTokenAndCandidateAuthUserIdOrderBySentAtDesc(
                assessmentToken,
                candidateId)).thenReturn(Optional.of(invite));
        when(applicationRepository.findByJobIdAndCandidateAuthUserId(jobId, candidateId))
                .thenReturn(List.of(invitedApplication, completedApplication, interviewApplication));
        when(jobRepository.findById(jobId)).thenReturn(Optional.of(job));
        when(notificationServiceClient.sendNotification(any()))
                .thenReturn(NotificationResponse.builder().status("SENT").build());

        AssessmentDisqualificationNotificationResponse response =
                assessmentInviteService.notifyAssessmentDisqualification(request);

        assertThat(response.isSent()).isTrue();
        ArgumentCaptor<Application> applicationCaptor = ArgumentCaptor.forClass(Application.class);
        verify(applicationRepository, times(2)).save(applicationCaptor.capture());
        assertThat(applicationCaptor.getAllValues())
                .extracting(Application::getId, Application::getStatus)
                .containsExactlyInAnyOrder(
                        org.assertj.core.groups.Tuple.tuple(invitedApplication.getId(), ApplicationStatus.DISQUALIFIED),
                        org.assertj.core.groups.Tuple.tuple(completedApplication.getId(), ApplicationStatus.DISQUALIFIED));
        assertThat(interviewApplication.getStatus()).isEqualTo(ApplicationStatus.INTERVIEW_INVITED);
    }
}
