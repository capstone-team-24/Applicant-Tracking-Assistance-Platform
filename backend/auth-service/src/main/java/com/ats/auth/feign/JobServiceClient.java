package com.ats.auth.feign;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestParam;

import java.util.UUID;

@FeignClient(name = "jobs-service", path = "/internal/jobs")
public interface JobServiceClient {

    @PutMapping("/recruiter/{recruiterId}/suspend")
    void suspendJobsByRecruiter(@PathVariable("recruiterId") UUID recruiterId, @RequestParam("suspend") boolean suspend);
}
