package com.ats.jobs.controller;

import com.ats.jobs.dto.AssessmentDisqualificationNotificationResponse;
import com.ats.jobs.dto.AssessmentDisqualificationRequest;
import com.ats.jobs.service.AssessmentInviteService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/internal/assessment-disqualifications")
@RequiredArgsConstructor
public class InternalAssessmentDisqualificationController {

    private final AssessmentInviteService assessmentInviteService;

    @Value("${INTERNAL_SERVICE_TOKEN:dev-internal-token}")
    private String internalServiceToken;

    @PostMapping
    public ResponseEntity<AssessmentDisqualificationNotificationResponse> notifyDisqualification(
            @RequestHeader(value = "X-Internal-Service-Token", required = false) String token,
            @RequestBody AssessmentDisqualificationRequest request) {
        if (!internalServiceToken.equals(token)) {
            return ResponseEntity.status(403).build();
        }

        AssessmentDisqualificationNotificationResponse response =
                assessmentInviteService.notifyAssessmentDisqualification(request);
        return ResponseEntity.ok(response);
    }
}
