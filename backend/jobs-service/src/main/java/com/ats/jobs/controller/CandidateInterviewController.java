package com.ats.jobs.controller;

import com.ats.jobs.dto.BookInterviewRequest;
import com.ats.jobs.dto.CandidateBookingResponse;
import com.ats.jobs.dto.CandidateInterviewSlotResponse;
import com.ats.jobs.entity.InterviewBooking;
import com.ats.jobs.service.InterviewSchedulingService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/interviews")
@RequiredArgsConstructor
public class CandidateInterviewController {

    private final InterviewSchedulingService schedulingService;

    @GetMapping("/available-slots/{jobId}")
    public ResponseEntity<List<CandidateInterviewSlotResponse>> getAvailableSlots(
            @PathVariable UUID jobId,
            @RequestHeader("X-User-Id") UUID candidateId) {
            
        return ResponseEntity.ok(schedulingService.getAvailableSlots(jobId, candidateId));
    }

    @PostMapping("/book")
    public ResponseEntity<InterviewBooking> bookInterview(
            @RequestParam UUID jobId,
            @RequestBody BookInterviewRequest request,
            @RequestHeader("X-User-Id") UUID candidateId) {
            
        return ResponseEntity.ok(schedulingService.bookInterview(jobId, request, candidateId));
    }

    @GetMapping("/me/bookings")
    public ResponseEntity<List<CandidateBookingResponse>> getMyBookings(
            @RequestHeader("X-User-Id") UUID candidateId) {
            
        return ResponseEntity.ok(schedulingService.getCandidateBookings(candidateId));
    }
}
