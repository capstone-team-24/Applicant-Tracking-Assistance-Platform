package com.ats.notification.listener;

import com.ats.notification.config.KafkaConfig;
import com.ats.notification.dto.NotificationEvent;
import com.ats.notification.service.NotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class NotificationEventListener {

    private final NotificationService notificationService;

    @KafkaListener(topics = KafkaConfig.TOPIC_APPLICATION_SUBMITTED, groupId = "notification-service")
    public void handleApplicationSubmitted(NotificationEvent event) {
        log.info("Received application.submitted event: {}", event.getEventType());
        try {
            notificationService.processApplicationSubmitted(event);
        } catch (Exception e) {
            log.error("Error processing application.submitted event: {}", e.getMessage(), e);
        }
    }

    @KafkaListener(topics = KafkaConfig.TOPIC_PARSE_COMPLETED, groupId = "notification-service")
    public void handleParseCompleted(NotificationEvent event) {
        log.info("Received resume.parse.completed event: {}", event.getEventType());
        try {
            notificationService.processParseCompleted(event);
        } catch (Exception e) {
            log.error("Error processing resume.parse.completed event: {}", e.getMessage(), e);
        }
    }

    @KafkaListener(topics = KafkaConfig.TOPIC_RANK_RESULT, groupId = "notification-service")
    public void handleRankResult(NotificationEvent event) {
        log.info("Received job.rank.result event: {}", event.getEventType());
        try {
            notificationService.processRankResult(event);
        } catch (Exception e) {
            log.error("Error processing job.rank.result event: {}", e.getMessage(), e);
        }
    }
}
