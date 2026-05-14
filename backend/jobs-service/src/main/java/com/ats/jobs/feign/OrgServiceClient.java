package com.ats.jobs.feign;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

import java.util.UUID;

@FeignClient(name = "user-service", contextId = "orgServiceClient", path = "/internal/organizations")
public interface OrgServiceClient {

    @GetMapping("/{orgId}/name")
    String getOrganizationName(@PathVariable("orgId") UUID orgId);
}
