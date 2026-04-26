package com.ats.user;

import com.ats.user.controller.ProfileController;
import com.ats.user.dto.ProfileResponse;
import com.ats.user.service.UserProfileService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.util.UUID;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(ProfileController.class)
class ProfileControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private UserProfileService userProfileService;

    @Test
    @DisplayName("GET /profiles/me - should return current user's profile")
    void getMyProfile_success() throws Exception {
        UUID authUserId = UUID.randomUUID();
        UUID profileId = UUID.randomUUID();

        ProfileResponse profileResponse = ProfileResponse.builder()
                .id(profileId)
                .authUserId(authUserId)
                .firstName("Alice")
                .lastName("Smith")
                .email("alice@example.com")
                .role("CANDIDATE")
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();

        when(userProfileService.getProfileByAuthUserId(authUserId)).thenReturn(profileResponse);

        mockMvc.perform(get("/profiles/me")
                        .header("X-User-Id", authUserId.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.firstName").value("Alice"))
                .andExpect(jsonPath("$.lastName").value("Smith"))
                .andExpect(jsonPath("$.email").value("alice@example.com"))
                .andExpect(jsonPath("$.role").value("CANDIDATE"))
                .andExpect(jsonPath("$.id").value(profileId.toString()))
                .andExpect(jsonPath("$.authUserId").value(authUserId.toString()));
    }

    @Test
    @DisplayName("GET /profiles/me - should return 400 when X-User-Id header is missing")
    void getMyProfile_missingHeader() throws Exception {
        mockMvc.perform(get("/profiles/me"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("GET /profiles/{id} - should return profile by ID")
    void getProfile_success() throws Exception {
        UUID profileId = UUID.randomUUID();
        UUID authUserId = UUID.randomUUID();

        ProfileResponse profileResponse = ProfileResponse.builder()
                .id(profileId)
                .authUserId(authUserId)
                .firstName("Bob")
                .lastName("Jones")
                .email("bob@example.com")
                .role("RECRUITER")
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();

        when(userProfileService.getProfile(profileId)).thenReturn(profileResponse);

        mockMvc.perform(get("/profiles/{id}", profileId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.firstName").value("Bob"))
                .andExpect(jsonPath("$.lastName").value("Jones"))
                .andExpect(jsonPath("$.role").value("RECRUITER"));
    }
}
