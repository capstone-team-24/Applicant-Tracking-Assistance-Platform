package com.ats.jobs.controller;

import com.ats.jobs.dto.CreateInterviewSlotsRequest;
import com.ats.jobs.dto.SubmitInterviewFeedbackRequest;
import com.ats.jobs.entity.InterviewBooking;
import com.ats.jobs.entity.InterviewSlot;
import com.ats.jobs.service.InterviewSchedulingService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/jobs/{jobId}")
@RequiredArgsConstructor
public class RecruiterInterviewController {

    private final InterviewSchedulingService schedulingService;

    @PostMapping("/slots")
    public ResponseEntity<List<InterviewSlot>> createSlots(
            @PathVariable UUID jobId,
            @RequestBody CreateInterviewSlotsRequest request,
            @RequestHeader("X-User-Id") UUID recruiterId,
            @RequestHeader(value = "X-Org-Id", required = false) UUID orgId) {
        
        return ResponseEntity.ok(schedulingService.createSlots(jobId, request, recruiterId, orgId));
    }

    @GetMapping("/slots")
    public ResponseEntity<List<InterviewSlot>> getJobSlots(
            @PathVariable UUID jobId,
            @RequestHeader("X-User-Id") UUID recruiterId,
            @RequestHeader(value = "X-Org-Id", required = false) UUID orgId) {
            
        return ResponseEntity.ok(schedulingService.getJobSlots(jobId, recruiterId, orgId));
    }

    @GetMapping("/bookings")
    public ResponseEntity<List<InterviewBooking>> getJobBookings(
            @PathVariable UUID jobId,
            @RequestHeader("X-User-Id") UUID recruiterId,
            @RequestHeader(value = "X-Org-Id", required = false) UUID orgId) {
            
        return ResponseEntity.ok(schedulingService.getJobBookings(jobId, recruiterId, orgId));
    }

    @PutMapping("/bookings/{bookingId}/complete")
    public ResponseEntity<InterviewBooking> completeBooking(
            @PathVariable UUID jobId,
            @PathVariable UUID bookingId,
            @RequestBody SubmitInterviewFeedbackRequest request,
            @RequestHeader("X-User-Id") UUID recruiterId,
            @RequestHeader(value = "X-Org-Id", required = false) UUID orgId) {

        return ResponseEntity.ok(schedulingService.completeBooking(jobId, bookingId, request, recruiterId, orgId));
    }
}
