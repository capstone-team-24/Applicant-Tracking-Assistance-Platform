package com.ats.auth.feign;

import com.ats.auth.dto.SendNotificationRequest;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

@FeignClient(name = "notification-service", path = "/api/v1/notifications")
public interface NotificationServiceClient {

    @PostMapping("/send")
    void sendNotification(@RequestBody SendNotificationRequest request);
}
