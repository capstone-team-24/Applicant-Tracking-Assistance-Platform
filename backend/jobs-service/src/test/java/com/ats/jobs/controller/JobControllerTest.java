package com.ats.jobs.controller;

import com.ats.jobs.dto.JobResponse;
import com.ats.jobs.enums.JobStatus;
import com.ats.jobs.service.JobService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(JobController.class)
class JobControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private JobService jobService;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void createJob_withRecruiterRole_shouldReturn201() throws Exception {
        UUID userId = UUID.randomUUID();
        UUID orgId = UUID.randomUUID();
        UUID jobId = UUID.randomUUID();

        JobResponse mockResponse = JobResponse.builder()
                .id(jobId)
                .orgId(orgId)
                .title("Senior Java Developer")
                .description("Looking for a senior developer")
                .location("Remote")
                .employmentType("FULL_TIME")
                .experienceLevel("SENIOR")
                .skills(List.of("Java", "Spring Boot"))
                .status(JobStatus.DRAFT)
                .createdBy(userId)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();

        when(jobService.createJob(any(), eq(userId), eq(orgId))).thenReturn(mockResponse);

        String requestBody = """
                {
                    "title": "Senior Java Developer",
                    "description": "Looking for a senior developer",
                    "location": "Remote",
                    "employmentType": "FULL_TIME",
                    "experienceLevel": "SENIOR",
                    "skills": ["Java", "Spring Boot"]
                }
                """;

        mockMvc.perform(post("/api/v1/jobs")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-User-Id", userId.toString())
                        .header("X-User-Role", "RECRUITER")
                        .header("X-Org-Id", orgId.toString())
                        .content(requestBody))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(jobId.toString()))
                .andExpect(jsonPath("$.title").value("Senior Java Developer"))
                .andExpect(jsonPath("$.status").value("DRAFT"))
                .andExpect(jsonPath("$.orgId").value(orgId.toString()));
    }

    @Test
    void createJob_withoutRecruiterRole_shouldReturn403() throws Exception {
        UUID userId = UUID.randomUUID();
        UUID orgId = UUID.randomUUID();

        String requestBody = """
                {
                    "title": "Senior Java Developer",
                    "description": "Looking for a senior developer"
                }
                """;

        mockMvc.perform(post("/api/v1/jobs")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-User-Id", userId.toString())
                        .header("X-User-Role", "CANDIDATE")
                        .header("X-Org-Id", orgId.toString())
                        .content(requestBody))
                .andExpect(status().isForbidden());
    }

    @Test
    void createJob_withoutTitle_shouldReturn400() throws Exception {
        UUID userId = UUID.randomUUID();
        UUID orgId = UUID.randomUUID();

        String requestBody = """
                {
                    "description": "Looking for a senior developer"
                }
                """;

        mockMvc.perform(post("/api/v1/jobs")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-User-Id", userId.toString())
                        .header("X-User-Role", "RECRUITER")
                        .header("X-Org-Id", orgId.toString())
                        .content(requestBody))
                .andExpect(status().isBadRequest());
    }
}
