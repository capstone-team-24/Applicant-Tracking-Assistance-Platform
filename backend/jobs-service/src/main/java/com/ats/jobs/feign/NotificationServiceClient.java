package com.ats.jobs.feign;

import com.ats.jobs.dto.NotificationSendRequest;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

@FeignClient(
        name = "notification-service",
        url = "${NOTIFICATION_SERVICE_URL:http://notification-service:8084}",
        path = "/api/v1/notifications"
)
public interface NotificationServiceClient {

    @PostMapping("/send")
    void sendNotification(@RequestBody NotificationSendRequest request);
}
