package com.ats.notification.websocket;

import com.ats.notification.dto.NotificationResponse;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Component
@RequiredArgsConstructor
@Slf4j
public class NotificationWebSocketHandler extends TextWebSocketHandler {

    private static final String USER_ID_ATTRIBUTE = "userId";

    private final ObjectMapper objectMapper;
    private final ConcurrentHashMap<UUID, Set<WebSocketSession>> sessionsByUser = new ConcurrentHashMap<>();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws IOException {
        UUID userId = extractUserId(session);
        if (userId == null) {
            session.close(CloseStatus.NOT_ACCEPTABLE.withReason("Missing authenticated user"));
            return;
        }

        session.getAttributes().put(USER_ID_ATTRIBUTE, userId);
        sessionsByUser.computeIfAbsent(userId, ignored -> ConcurrentHashMap.newKeySet()).add(session);
        log.info("Notification websocket connected for user {}", userId);
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        Object rawUserId = session.getAttributes().get(USER_ID_ATTRIBUTE);
        if (rawUserId instanceof UUID userId) {
            removeSession(userId, session);
            log.info("Notification websocket disconnected for user {} with status {}", userId, status);
        }
    }

    public void sendToUser(UUID userId, NotificationResponse notification) {
        Set<WebSocketSession> sessions = sessionsByUser.get(userId);
        if (sessions == null || sessions.isEmpty()) {
            return;
        }

        String payload;
        try {
            payload = objectMapper.writeValueAsString(notification);
        } catch (JsonProcessingException e) {
            log.error("Failed to serialize push notification {}: {}", notification.getId(), e.getMessage(), e);
            return;
        }

        TextMessage message = new TextMessage(payload);
        for (WebSocketSession session : Set.copyOf(sessions)) {
            if (!session.isOpen()) {
                removeSession(userId, session);
                continue;
            }

            try {
                synchronized (session) {
                    if (session.isOpen()) {
                        session.sendMessage(message);
                    }
                }
            } catch (IOException e) {
                log.warn("Failed to send push notification {} to user {}: {}", notification.getId(), userId, e.getMessage());
                removeSession(userId, session);
            }
        }
    }

    private UUID extractUserId(WebSocketSession session) {
        String userIdHeader = session.getHandshakeHeaders().getFirst("X-User-Id");
        if (userIdHeader == null || userIdHeader.isBlank()) {
            return null;
        }
        try {
            return UUID.fromString(userIdHeader);
        } catch (IllegalArgumentException e) {
            log.warn("Invalid X-User-Id header on notification websocket: {}", userIdHeader);
            return null;
        }
    }

    private void removeSession(UUID userId, WebSocketSession session) {
        Set<WebSocketSession> sessions = sessionsByUser.get(userId);
        if (sessions == null) {
            return;
        }
        sessions.remove(session);
        if (sessions.isEmpty()) {
            sessionsByUser.remove(userId, sessions);
        }
    }
}
