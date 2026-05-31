package com.ats.notification.controller;

import com.ats.notification.dto.NotificationResponse;
import com.ats.notification.dto.SendNotificationRequest;
import com.ats.notification.service.NotificationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/notifications")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Notifications", description = "Notification management endpoints")
public class NotificationController {

    private final NotificationService notificationService;

    @GetMapping
    @Operation(summary = "List notifications for current user",
               description = "Returns a paginated list of notifications for the user identified by X-User-Id header")
    public ResponseEntity<Page<NotificationResponse>> getNotifications(
            @Parameter(description = "User ID from gateway/auth header")
            @RequestHeader(value = "X-User-Id", required = false) String userIdHeader,
            @PageableDefault(size = 20) Pageable pageable) {

        if (userIdHeader == null || userIdHeader.isBlank()) {
            log.warn("X-User-Id header missing; returning empty page");
            return ResponseEntity.ok(Page.empty(pageable));
        }

        UUID userId = UUID.fromString(userIdHeader);
        Page<NotificationResponse> notifications = notificationService.getNotifications(userId, pageable);
        return ResponseEntity.ok(notifications);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get a single notification by ID")
    public ResponseEntity<NotificationResponse> getNotificationById(
            @PathVariable UUID id) {
        NotificationResponse notification = notificationService.getNotificationById(id);
        return ResponseEntity.ok(notification);
    }

    @PostMapping("/send")
    @Operation(summary = "Send an arbitrary notification (admin)",
               description = "Admin endpoint to send a notification email to any recipient")
    public ResponseEntity<NotificationResponse> sendNotification(
            @Valid @RequestBody SendNotificationRequest request) {
        log.info("Admin send notification request to {}", request.getRecipientEmail());
        NotificationResponse response = notificationService.sendNotification(request);
        return ResponseEntity.ok(response);
    }
}
