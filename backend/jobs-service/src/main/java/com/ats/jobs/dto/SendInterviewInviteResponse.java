package com.ats.jobs.dto;

import lombok.*;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SendInterviewInviteResponse {

    private int sent;
    private int skipped;
    private List<String> sentTo;
    private List<String> skippedReasons;
}
