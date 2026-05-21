package com.ats.user.feign;

import com.ats.user.dto.SendNotificationRequest;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

@FeignClient(
        name = "notification-service",
        url = "${notification.service.url}"
)
public interface NotificationServiceClient {

    @PostMapping("/api/v1/notifications/send")
    void sendNotification(@RequestBody SendNotificationRequest request);
}