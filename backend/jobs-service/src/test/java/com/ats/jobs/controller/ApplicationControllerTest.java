package com.ats.jobs.controller;

import com.ats.jobs.dto.CandidateApplicationDetailResponse;
import com.ats.jobs.dto.JobResponse;
import com.ats.jobs.enums.ApplicationStatus;
import com.ats.jobs.enums.JobStatus;
import com.ats.jobs.service.ApplicationService;
import com.ats.jobs.service.AssessmentInviteService;
import com.ats.jobs.service.InterviewInviteService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(ApplicationController.class)
class ApplicationControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private ApplicationService applicationService;

    @MockitoBean
    private AssessmentInviteService assessmentInviteService;

    @MockitoBean
    private InterviewInviteService interviewInviteService;

    @Test
    void recruiterDetail_requiresRecruiterRole() throws Exception {
        UUID applicationId = UUID.randomUUID();

        mockMvc.perform(get("/api/v1/applications/{id}", applicationId)
                        .header("X-User-Id", UUID.randomUUID().toString())
                        .header("X-User-Role", "CANDIDATE"))
                .andExpect(status().isForbidden());

        verifyNoInteractions(applicationService);
    }

    @Test
    void candidateDetail_returnsSafePayload() throws Exception {
        UUID applicationId = UUID.randomUUID();
        UUID candidateId = UUID.randomUUID();

        CandidateApplicationDetailResponse response = CandidateApplicationDetailResponse.builder()
                .id(applicationId)
                .jobId(UUID.randomUUID())
                .job(JobResponse.builder()
                        .id(UUID.randomUUID())
                        .title("Backend Engineer")
                        .description("Build APIs")
                        .requirements("Java, Spring Boot")
                        .location("Remote")
                        .employmentType("FULL_TIME")
                        .experienceLevel("MID")
                        .status(JobStatus.PUBLISHED)
                        .build())
                .candidateName("John Smith")
                .candidateEmail("john@example.com")
                .contactPhone("+1-555-0100")
                .coverLetter("Excited to apply.")
                .originalFilename("resume.pdf")
                .status(ApplicationStatus.APPLIED)
                .createdAt(LocalDateTime.of(2026, 5, 30, 9, 15))
                .updatedAt(LocalDateTime.of(2026, 5, 30, 9, 15))
                .build();

        when(applicationService.getMyApplicationDetail(eq(applicationId), eq(candidateId)))
                .thenReturn(response);

        mockMvc.perform(get("/api/v1/applications/me/{id}", applicationId)
                        .header("X-User-Id", candidateId.toString())
                        .header("X-User-Role", "CANDIDATE"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(applicationId.toString()))
                .andExpect(jsonPath("$.candidateName").value("John Smith"))
                .andExpect(jsonPath("$.originalFilename").value("resume.pdf"))
                .andExpect(jsonPath("$.job.title").value("Backend Engineer"))
                .andExpect(jsonPath("$.status").value("APPLIED"))
                .andExpect(jsonPath("$.compositeScore").doesNotExist())
                .andExpect(jsonPath("$.rankingPosition").doesNotExist())
                .andExpect(jsonPath("$.parseConfidence").doesNotExist())
                .andExpect(jsonPath("$.originalFilePath").doesNotExist());
    }
}
