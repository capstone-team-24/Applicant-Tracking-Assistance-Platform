package com.ats.jobs.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SubmitInterviewFeedbackRequest {
    private Integer rating;
    private String feedback;
    // Detailed interview metrics (0-10)
    private Integer technical;
    private Integer problemSolving;
    private Integer communication;
    private Integer behavioral;
    private Integer cultureFit;
}
