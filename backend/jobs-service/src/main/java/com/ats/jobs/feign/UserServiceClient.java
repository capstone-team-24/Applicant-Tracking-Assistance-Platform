package com.ats.jobs.feign;

import com.ats.jobs.dto.ApplicationDataResponse;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

import java.util.UUID;

@FeignClient(name = "user-service", path = "/internal/profiles")
public interface UserServiceClient {

    @GetMapping("/{authUserId}/application-data")
    ApplicationDataResponse getApplicationData(@PathVariable("authUserId") UUID authUserId);
}
