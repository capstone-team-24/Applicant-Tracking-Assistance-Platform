package com.ats.user.repository;

import com.ats.user.entity.ContactMessage;
import com.ats.user.entity.ContactMessageStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface ContactMessageRepository extends JpaRepository<ContactMessage, UUID> {

    Page<ContactMessage> findByStatus(ContactMessageStatus status, Pageable pageable);

    Optional<ContactMessage> findByRevisionToken(String revisionToken);
}

