package com.ats.user.service;

import com.ats.user.dto.ContactMessageRequest;
import com.ats.user.dto.ContactMessageResponse;
import com.ats.user.entity.ContactMessage;
import com.ats.user.repository.ContactMessageRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Slf4j
public class ContactMessageService {

    private final ContactMessageRepository contactMessageRepository;

    @Transactional
    public ContactMessageResponse create(ContactMessageRequest request) {
        ContactMessage message = ContactMessage.builder()
                .name(request.getName())
                .email(request.getEmail())
                .message(request.getMessage())
                .build();

        ContactMessage saved = contactMessageRepository.save(message);
        log.info("Saved new contact message from {}", saved.getEmail());

        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public Page<ContactMessageResponse> getAllMessages(Pageable pageable) {
        return contactMessageRepository.findAll(pageable)
                .map(this::toResponse);
    }

    private ContactMessageResponse toResponse(ContactMessage message) {
        return ContactMessageResponse.builder()
                .id(message.getId())
                .name(message.getName())
                .email(message.getEmail())
                .message(message.getMessage())
                .createdAt(message.getCreatedAt())
                .build();
    }
}
