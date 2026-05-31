package com.ats.jobs.dto;

import com.ats.jobs.entity.InterviewBooking.BookingStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CandidateBookingResponse {
    private UUID id;
    private UUID jobId;
    private String jobTitle;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private String meetingLink;
    private BookingStatus status;
}
