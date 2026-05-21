package com.ats.user.service;

import com.ats.user.dto.ContactMessageRequest;
import com.ats.user.dto.ContactMessageResponse;
import com.ats.user.dto.CreateOrganizationRequest;
import com.ats.user.dto.OrganizationResponse;
import com.ats.user.dto.SendNotificationRequest;
import com.ats.user.entity.ContactMessage;
import com.ats.user.feign.NotificationServiceClient;
import com.ats.user.exception.ResourceNotFoundException;
import com.ats.user.repository.ContactMessageRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class ContactMessageService {

    private final ContactMessageRepository contactMessageRepository;
    private final OrganizationService organizationService;
    private final NotificationServiceClient notificationServiceClient;
    private final ObjectMapper objectMapper;

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

    @Transactional
    public OrganizationResponse approve(UUID id) {
        ContactMessage message = contactMessageRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("ContactMessage", "id", id));

        if (message.getApprovedAt() != null) {
            throw new IllegalStateException("Contact message has already been approved.");
        }

        CreateOrganizationRequest organizationRequest = CreateOrganizationRequest.builder()
                .name(message.getName())
                .organizationPolicies(buildOrganizationPolicies(message))
                .build();

        OrganizationResponse organization = organizationService.create(organizationRequest);

        message.setApprovedAt(LocalDateTime.now());
        message.setApprovedOrganizationId(organization.getId());
        contactMessageRepository.save(message);

        try {
            notificationServiceClient.sendNotification(SendNotificationRequest.builder()
                    .recipientEmail(message.getEmail())
                    .subject("Your organization has been approved and created")
                    .body(buildApprovalEmailHtml(message, organization))
                    .type("EMAIL")
                    .build());
        } catch (Exception e) {
            log.warn("Organization {} created for contact message {}, but approval email to {} failed: {}",
                    organization.getId(), id, message.getEmail(), e.getMessage());
        }

        log.info("Approved contact message {} and created organization {}", id, organization.getId());
        return organization;
    }

    private ContactMessageResponse toResponse(ContactMessage message) {
        return ContactMessageResponse.builder()
                .id(message.getId())
                .name(message.getName())
                .email(message.getEmail())
                .message(message.getMessage())
                .approvedAt(message.getApprovedAt())
                .approvedOrganizationId(message.getApprovedOrganizationId())
                .createdAt(message.getCreatedAt())
                .build();
    }

    private String buildOrganizationPolicies(ContactMessage message) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("sourceContactMessageId", message.getId().toString());
        payload.put("sourceContactName", message.getName());
        payload.put("sourceContactEmail", message.getEmail());
        payload.put("sourceContactMessage", message.getMessage());

        try {
            return objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException e) {
            log.warn("Failed to serialize organization policies for contact message {}: {}", message.getId(), e.getMessage());
            return "{}";
        }
    }

        private String buildApprovalEmailHtml(ContactMessage message, OrganizationResponse organization) {
        return """
                <html>
                  <body style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
                    <div style="max-width: 640px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 16px;">
                      <h2 style="margin-top: 0;">Your organization has been created</h2>
                                            <p>Organization <strong>%s</strong> has been approved and created successfully.</p>
                                            <p><strong>Organization ID:</strong> %s</p>
                                            <p><strong>Submitted contact email:</strong> %s</p>
                                            <p>We received the following request details from your contact message:</p>
                                            <blockquote style="padding: 16px; background: #f9fafb; border-left: 4px solid #6366f1; margin: 0 0 16px 0;">%s</blockquote>
                                            <p>Your HR admin notification has been sent, and you can continue with the next setup steps for the organization.</p>
                    </div>
                  </body>
                </html>
                                """.formatted(
                                escapeHtml(organization.getName()),
                                organization.getId(),
                                escapeHtml(message.getEmail()),
                                escapeHtml(message.getMessage())
                );
        }

        private String escapeHtml(String value) {
                if (value == null) {
                        return "";
                }

                return value
                                .replace("&", "&amp;")
                                .replace("<", "&lt;")
                                .replace(">", "&gt;")
                                .replace("\"", "&quot;")
                                .replace("'", "&#39;");
    }
}
