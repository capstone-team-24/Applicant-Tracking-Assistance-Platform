package com.ats.jobs.controller;

import com.ats.jobs.service.JobService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/internal/jobs")
@RequiredArgsConstructor
public class InternalJobController {

    private final JobService jobService;

    @PutMapping("/recruiter/{recruiterId}/suspend")
    public ResponseEntity<Void> suspendJobsByRecruiter(
            @PathVariable UUID recruiterId,
            @RequestParam boolean suspend) {
        jobService.suspendJobsByRecruiter(recruiterId, suspend);
        return ResponseEntity.ok().build();
    }
}
