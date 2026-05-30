package com.ats.jobs.controller;

import com.ats.jobs.entity.Application;
import com.ats.jobs.entity.AssessmentInvite;
import com.ats.jobs.enums.ApplicationStatus;
import com.ats.jobs.feign.OrgServiceClient;
import com.ats.jobs.feign.UserServiceClient;
import com.ats.jobs.repository.ApplicationRepository;
import com.ats.jobs.repository.AssessmentInviteRepository;
import com.ats.jobs.repository.JobRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.data.domain.Pageable;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(AssessmentInviteController.class)
class AssessmentInviteControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private AssessmentInviteRepository assessmentInviteRepository;

    @MockitoBean
    private ApplicationRepository applicationRepository;

    @MockitoBean
    private JobRepository jobRepository;

    @MockitoBean
    private OrgServiceClient orgServiceClient;

    @MockitoBean
    private UserServiceClient userServiceClient;

    @Test
    void getReceivedAssessments_hidesDisqualifiedApplications() throws Exception {
        UUID candidateId = UUID.randomUUID();
        UUID applicationId = UUID.randomUUID();

        AssessmentInvite invite = AssessmentInvite.builder()
                .id(UUID.randomUUID())
                .applicationId(applicationId)
                .candidateAuthUserId(candidateId)
                .jobId(UUID.randomUUID())
                .jobTitle("Backend Engineer")
                .assessmentToken("oa-token")
                .sentAt(LocalDateTime.now())
                .build();

        Application application = Application.builder()
                .id(applicationId)
                .status(ApplicationStatus.DISQUALIFIED)
                .build();

        when(assessmentInviteRepository.findByCandidateAuthUserIdOrderBySentAtDesc(
                eq(candidateId),
                any(Pageable.class)))
                .thenReturn(List.of(invite));
        when(applicationRepository.findAllById(any()))
                .thenReturn(List.of(application));

        mockMvc.perform(get("/api/v1/applications/me/assessment-invites")
                        .header("X-User-Id", candidateId.toString()))
                .andExpect(status().isOk())
                .andExpect(content().json("[]"));
    }
}
