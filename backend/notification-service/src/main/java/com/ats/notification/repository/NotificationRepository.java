package com.ats.notification.repository;

import com.ats.notification.entity.Notification;
import com.ats.notification.enums.NotificationStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, UUID> {

    Page<Notification> findByRecipientUserId(UUID recipientUserId, Pageable pageable);

    List<Notification> findByStatus(NotificationStatus status);

    List<Notification> findByType(String type);
}
