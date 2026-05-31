package com.ats.auth.feign;

import com.ats.auth.dto.BootstrapProfileRequest;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

@FeignClient(name = "user-service", path = "/internal/profiles")
public interface UserServiceClient {

    @PostMapping("/bootstrap")
    void bootstrapProfile(@RequestBody BootstrapProfileRequest request);
}
