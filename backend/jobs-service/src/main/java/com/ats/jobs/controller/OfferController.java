package com.ats.jobs.controller;

import com.ats.jobs.dto.DeclineOfferRequest;
import com.ats.jobs.dto.OfferResponse;
import com.ats.jobs.dto.SendOfferRequest;
import com.ats.jobs.service.OfferService;
import com.ats.jobs.util.HeaderContext;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class OfferController {

    private final OfferService offerService;

    @PostMapping("/jobs/{jobId}/applications/{appId}/offer")
    public ResponseEntity<OfferResponse> sendOffer(
            @PathVariable UUID jobId,
            @PathVariable UUID appId,
            @RequestBody SendOfferRequest request,
            HttpServletRequest httpRequest) {

        HeaderContext.assertRecruiter(httpRequest);
        UUID recruiterId = HeaderContext.getAuthUserId(httpRequest);

        OfferResponse response = offerService.sendOffer(appId, recruiterId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/offers/{token}")
    public ResponseEntity<OfferResponse> getOffer(@PathVariable String token) {
        OfferResponse response = offerService.getOfferByToken(token);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/offers/{token}/accept")
    public ResponseEntity<Void> acceptOffer(@PathVariable String token) {
        offerService.acceptOffer(token);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/offers/{token}/decline")
    public ResponseEntity<Void> declineOffer(
            @PathVariable String token,
            @RequestBody(required = false) DeclineOfferRequest request) {
        offerService.declineOffer(token, request);
        return ResponseEntity.ok().build();
    }
}
