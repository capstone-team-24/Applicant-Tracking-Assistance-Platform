package com.ats.jobs.controller;

import com.ats.jobs.dto.ReceivedInterviewInviteResponse;
import com.ats.jobs.entity.InterviewInvite;
import com.ats.jobs.repository.InterviewInviteRepository;
import com.ats.jobs.util.HeaderContext;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/applications/me")
@RequiredArgsConstructor
public class InterviewInviteController {

    private final InterviewInviteRepository interviewInviteRepository;

    @GetMapping("/interview-invites")
    public ResponseEntity<List<ReceivedInterviewInviteResponse>> getReceivedInterviewInvites(
            HttpServletRequest request) {

        UUID authUserId = HeaderContext.getAuthUserId(request);
        if (authUserId == null) {
            return ResponseEntity.status(401).build();
        }

        List<InterviewInvite> invites = interviewInviteRepository
                .findByCandidateAuthUserIdOrderBySentAtDesc(authUserId, PageRequest.of(0, 50));

        List<ReceivedInterviewInviteResponse> response = invites.stream()
                .map(i -> ReceivedInterviewInviteResponse.builder()
                        .id(i.getId())
                        .jobId(i.getJobId())
                        .jobTitle(i.getJobTitle())
                        .oaScore(i.getOaScore())
                        .schedulingUrl(i.getSchedulingUrl())
                        .sentAt(i.getSentAt() != null ? i.getSentAt().toString() : null)
                        .expiresAt(i.getExpiresAt() != null ? i.getExpiresAt().toString() : null)
                        .build())
                .toList();

        return ResponseEntity.ok(response);
    }
}
