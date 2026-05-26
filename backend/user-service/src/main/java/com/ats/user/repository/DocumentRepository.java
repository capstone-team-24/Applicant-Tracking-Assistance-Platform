package com.ats.user.repository;

import com.ats.user.entity.Document;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface DocumentRepository extends JpaRepository<Document, UUID> {

    List<Document> findByProfileIdOrderByUploadedAtDesc(UUID profileId);

    List<Document> findByContactMessageIdOrderByUploadedAtDesc(UUID contactMessageId);
}

