package com.ats.user.service;

import com.ats.user.config.FileStorageConfig;
import com.ats.user.dto.ContactMessageRequest;
import com.ats.user.dto.ContactMessageResponse;
import com.ats.user.dto.CreateOrganizationRequest;
import com.ats.user.dto.DocumentResponse;
import com.ats.user.dto.InquiryRequest;
import com.ats.user.dto.OrganizationResponse;
import com.ats.user.dto.RejectContactMessageRequest;
import com.ats.user.dto.SendNotificationRequest;
import com.ats.user.dto.UpdateContactMessageRequest;
import com.ats.user.entity.ContactMessage;
import com.ats.user.entity.ContactMessageStatus;
import com.ats.user.entity.Document;
import com.ats.user.feign.AuthServiceClient;
import com.ats.user.feign.NotificationServiceClient;
import com.ats.user.exception.ResourceNotFoundException;
import com.ats.user.repository.ContactMessageRepository;
import com.ats.user.repository.DocumentRepository;
import com.ats.user.util.EmailTemplate;
import com.ats.user.util.FileUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.MalformedURLException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class ContactMessageService {

    private final ContactMessageRepository contactMessageRepository;
    private final OrganizationService organizationService;
    private final NotificationServiceClient notificationServiceClient;
    private final AuthServiceClient authServiceClient;
    private final DocumentRepository documentRepository;
    private final FileStorageConfig fileStorageConfig;

    @Value("${app.frontend-base-url:http://localhost:3000}")
    private String frontendBaseUrl;

    // ──────────────────────────────────────────────────────────────
    //  Create
    // ──────────────────────────────────────────────────────────────

    @Transactional
    public ContactMessageResponse create(ContactMessageRequest request) {
        ContactMessage message = ContactMessage.builder()
                .name(request.getName())
                .email(request.getEmail())
                .message(request.getMessage())
                .hrAdminName(request.getHrAdminName())
                .companyDetails(request.getCompanyDetails())
                .status(ContactMessageStatus.PENDING_APPROVAL)
                .build();

        ContactMessage saved = contactMessageRepository.save(message);
        log.info("Saved new contact message from {} — status=PENDING_APPROVAL", saved.getEmail());
        return toResponse(saved);
    }

    // ──────────────────────────────────────────────────────────────
    //  Read
    // ──────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public Page<ContactMessageResponse> getAllMessages(Pageable pageable) {
        return contactMessageRepository.findAll(pageable).map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public Page<ContactMessageResponse> getMessagesByStatus(ContactMessageStatus status, Pageable pageable) {
        return contactMessageRepository.findByStatus(status, pageable).map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public ContactMessageResponse getById(UUID id) {
        ContactMessage message = contactMessageRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("ContactMessage", "id", id));
        return toResponse(message);
    }

    @Transactional(readOnly = true)
    public ContactMessageResponse getByRevisionToken(String revisionToken) {
        ContactMessage message = contactMessageRepository.findByRevisionToken(revisionToken)
                .orElseThrow(() -> new ResourceNotFoundException("ContactMessage", "revisionToken", revisionToken));
        return toResponse(message);
    }

    // ──────────────────────────────────────────────────────────────
    //  Approve
    // ──────────────────────────────────────────────────────────────

    @Transactional
    public OrganizationResponse approve(UUID id) {
        ContactMessage message = contactMessageRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("ContactMessage", "id", id));

        if (message.getStatus() == ContactMessageStatus.APPROVED) {
            throw new IllegalStateException("Contact message has already been approved.");
        }
        if (message.getStatus() == ContactMessageStatus.REJECTED) {
            throw new IllegalStateException("Cannot approve a rejected contact message.");
        }

        // Create the organization
        CreateOrganizationRequest organizationRequest = CreateOrganizationRequest.builder()
                .name(message.getName())
                .build();

        OrganizationResponse organization = organizationService.create(organizationRequest);

        // Mark as approved
        message.setStatus(ContactMessageStatus.APPROVED);
        message.setApprovedAt(LocalDateTime.now());
        message.setApprovedOrganizationId(organization.getId());
        contactMessageRepository.save(message);

        // Generate the org-admin invite token
        String setupLink = null;
        try {
            AuthServiceClient.TokenResponse tokenResponse = authServiceClient.generateOrgAdminInviteToken(
                    AuthServiceClient.InviteOrgAdminRequest.builder()
                            .email(message.getEmail())
                            .orgId(organization.getId())
                            .build()
            );
            setupLink = frontendBaseUrl + "/invite/setup?token=" + tokenResponse.getToken();
            log.info("Org-admin invite token generated for {} for org {}", message.getEmail(), organization.getId());
        } catch (Exception e) {
            log.warn("Org created ({}) but failed to generate invite token for {}: {}",
                    organization.getId(), message.getEmail(), e.getMessage());
        }

        // Send approval email with setup link
        try {
            notificationServiceClient.sendNotification(SendNotificationRequest.builder()
                    .recipientEmail(message.getEmail())
                    .subject("Your organization registration is approved!")
                    .body(buildApprovalEmailHtml(message, organization, setupLink))
                    .type("EMAIL")
                    .build());
        } catch (Exception e) {
            log.warn("Approved message {} but approval email to {} failed: {}", id, message.getEmail(), e.getMessage());
        }

        log.info("Approved contact message {} → org {}", id, organization.getId());
        return organization;
    }

    // ──────────────────────────────────────────────────────────────
    //  Reject
    // ──────────────────────────────────────────────────────────────

    @Transactional
    public ContactMessageResponse reject(UUID id, RejectContactMessageRequest request) {
        ContactMessage message = contactMessageRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("ContactMessage", "id", id));

        if (message.getStatus() == ContactMessageStatus.APPROVED) {
            throw new IllegalStateException("Cannot reject an already-approved message.");
        }
        if (message.getStatus() == ContactMessageStatus.REJECTED) {
            throw new IllegalStateException("Contact message has already been rejected.");
        }

        message.setStatus(ContactMessageStatus.REJECTED);
        message.setRejectedAt(LocalDateTime.now());
        if (request != null && request.getReason() != null && !request.getReason().isBlank()) {
            message.setRejectionReason(request.getReason());
        }
        ContactMessage saved = contactMessageRepository.save(message);

        // Send rejection email
        try {
            notificationServiceClient.sendNotification(SendNotificationRequest.builder()
                    .recipientEmail(message.getEmail())
                    .subject("Your organization registration request — Decision")
                    .body(buildRejectionEmailHtml(message))
                    .type("EMAIL")
                    .build());
        } catch (Exception e) {
            log.warn("Rejected message {} but rejection email to {} failed: {}", id, message.getEmail(), e.getMessage());
        }

        log.info("Rejected contact message {} (email={})", id, message.getEmail());
        return toResponse(saved);
    }

    // ──────────────────────────────────────────────────────────────
    //  Send Inquiry
    // ──────────────────────────────────────────────────────────────

    @Transactional
    public ContactMessageResponse sendInquiry(UUID id, InquiryRequest request) {
        ContactMessage message = contactMessageRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("ContactMessage", "id", id));

        if (message.getStatus() == ContactMessageStatus.APPROVED) {
            throw new IllegalStateException("Cannot send inquiry on an approved message.");
        }
        if (message.getStatus() == ContactMessageStatus.REJECTED) {
            throw new IllegalStateException("Cannot send inquiry on a rejected message.");
        }

        message.setStatus(ContactMessageStatus.PENDING_RESPONSE);
        message.setInquiryMessage(request.getMessage());
        String token = UUID.randomUUID().toString();
        message.setRevisionToken(token);
        ContactMessage saved = contactMessageRepository.save(message);

        // Build the link to the org's revision page
        String revisionLink = frontendBaseUrl + "/org/inquiry/" + token;

        // Send inquiry email
        try {
            notificationServiceClient.sendNotification(SendNotificationRequest.builder()
                    .recipientEmail(message.getEmail())
                    .subject("We have a question about your organization registration")
                    .body(buildInquiryEmailHtml(message, request.getMessage(), revisionLink))
                    .type("EMAIL")
                    .build());
        } catch (Exception e) {
            log.warn("Inquiry status set on {} but email to {} failed: {}", id, message.getEmail(), e.getMessage());
        }

        log.info("Inquiry sent for contact message {} (email={})", id, message.getEmail());
        return toResponse(saved);
    }

    // ──────────────────────────────────────────────────────────────
    //  Update by Org (revision after inquiry)
    // ──────────────────────────────────────────────────────────────

    @Transactional
    public ContactMessageResponse updateByOrg(String revisionToken, UpdateContactMessageRequest request) {
        ContactMessage message = contactMessageRepository.findByRevisionToken(revisionToken)
                .orElseThrow(() -> new ResourceNotFoundException("ContactMessage", "revisionToken", revisionToken));

        if (message.getStatus() == ContactMessageStatus.APPROVED) {
            throw new IllegalStateException("This registration has already been approved.");
        }
        if (message.getStatus() == ContactMessageStatus.REJECTED) {
            throw new IllegalStateException("This registration has been rejected and cannot be updated.");
        }

        message.setMessage(request.getMessage());
        if (request.getHrAdminName() != null) {
            message.setHrAdminName(request.getHrAdminName());
        }
        if (request.getCompanyDetails() != null) {
            message.setCompanyDetails(request.getCompanyDetails());
        }
        // Reset status to PENDING_APPROVAL so admin can review again
        message.setStatus(ContactMessageStatus.PENDING_APPROVAL);
        message.setRevisionToken(null); // Clear token since it's a one-time use

        ContactMessage saved = contactMessageRepository.save(message);
        log.info("Org updated contact message {} → status=PENDING_APPROVAL", message.getId());
        return toResponse(saved);
    }

    // ──────────────────────────────────────────────────────────────
    //  Documents — upload / list / download / delete
    // ──────────────────────────────────────────────────────────────

    @Transactional
    public DocumentResponse uploadDocument(UUID contactMessageId, MultipartFile file) {
        ContactMessage message = contactMessageRepository.findById(contactMessageId)
                .orElseThrow(() -> new ResourceNotFoundException("ContactMessage", "id", contactMessageId));

        if (message.getStatus() == ContactMessageStatus.APPROVED ||
            message.getStatus() == ContactMessageStatus.REJECTED) {
            throw new IllegalStateException("Cannot upload documents for a " + message.getStatus() + " submission.");
        }

        if (file.isEmpty()) throw new IllegalArgumentException("Uploaded file is empty");

        String contentType = file.getContentType();
        if (!FileUtils.isAllowedContentType(contentType)) {
            throw new IllegalArgumentException("File type not allowed: " + contentType);
        }

        String originalFilename = file.getOriginalFilename();
        String sanitized = FileUtils.sanitizeFilename(originalFilename);
        if (!FileUtils.isAllowedExtension(sanitized)) {
            throw new IllegalArgumentException("File extension not allowed");
        }

        // Store under: {basePath}/registrations/{contactMessageId}/{filename}
        Path dir = Paths.get(fileStorageConfig.getBasePath(), "registrations", contactMessageId.toString());
        try {
            Files.createDirectories(dir);
            // Prefix with timestamp to avoid collisions
            String storedName = System.currentTimeMillis() + "_" + sanitized;
            Path dest = dir.resolve(storedName);
            Files.copy(file.getInputStream(), dest, StandardCopyOption.REPLACE_EXISTING);

            Document doc = Document.builder()
                    .contactMessageId(contactMessageId)
                    .filename(originalFilename != null ? originalFilename : sanitized)
                    .path(dest.toString())
                    .contentType(contentType)
                    .fileSize(file.getSize())
                    .build();
            Document saved = documentRepository.save(doc);
            log.info("Uploaded verification doc {} for contactMessage {}", storedName, contactMessageId);
            return toDocumentResponse(saved);
        } catch (IOException e) {
            log.error("Failed to store verification doc for contactMessage={}", contactMessageId, e);
            throw new RuntimeException("Failed to store file: " + e.getMessage(), e);
        }
    }

    @Transactional(readOnly = true)
    public List<DocumentResponse> listDocuments(UUID contactMessageId) {
        // Verify the contact message exists
        if (!contactMessageRepository.existsById(contactMessageId)) {
            throw new ResourceNotFoundException("ContactMessage", "id", contactMessageId);
        }
        return documentRepository.findByContactMessageIdOrderByUploadedAtDesc(contactMessageId)
                .stream().map(this::toDocumentResponse).toList();
    }

    @Transactional
    public DocumentResponse uploadDocumentByToken(String revisionToken, MultipartFile file) {
        ContactMessage message = contactMessageRepository.findByRevisionToken(revisionToken)
                .orElseThrow(() -> new ResourceNotFoundException("ContactMessage", "revisionToken", revisionToken));
        return uploadDocument(message.getId(), file);
    }

    @Transactional(readOnly = true)
    public List<DocumentResponse> listDocumentsByToken(String revisionToken) {
        ContactMessage message = contactMessageRepository.findByRevisionToken(revisionToken)
                .orElseThrow(() -> new ResourceNotFoundException("ContactMessage", "revisionToken", revisionToken));
        return listDocuments(message.getId());
    }

    @Transactional
    public void deleteDocumentByToken(String revisionToken, UUID documentId) {
        ContactMessage message = contactMessageRepository.findByRevisionToken(revisionToken)
                .orElseThrow(() -> new ResourceNotFoundException("ContactMessage", "revisionToken", revisionToken));
        deleteDocument(message.getId(), documentId);
    }

    @Transactional(readOnly = true)
    public ResponseEntity<Resource> downloadDocument(UUID contactMessageId, UUID documentId) {
        Document doc = documentRepository.findById(documentId)
                .orElseThrow(() -> new ResourceNotFoundException("Document", "id", documentId));

        if (!contactMessageId.equals(doc.getContactMessageId())) {
            throw new ResourceNotFoundException("Document", "id", documentId);
        }

        try {
            Path filePath = Paths.get(doc.getPath());
            Resource resource = new UrlResource(filePath.toUri());
            if (!resource.exists() || !resource.isReadable()) {
                throw new RuntimeException("File not found or not readable: " + doc.getPath());
            }
            return ResponseEntity.ok()
                    .contentType(MediaType.parseMediaType(doc.getContentType()))
                    .header(HttpHeaders.CONTENT_DISPOSITION,
                            "inline; filename=\"" + doc.getFilename() + "\"")
                    .body(resource);
        } catch (MalformedURLException e) {
            throw new RuntimeException("Failed to read file", e);
        }
    }

    @Transactional
    public void deleteDocument(UUID contactMessageId, UUID documentId) {
        Document doc = documentRepository.findById(documentId)
                .orElseThrow(() -> new ResourceNotFoundException("Document", "id", documentId));

        if (!contactMessageId.equals(doc.getContactMessageId())) {
            throw new ResourceNotFoundException("Document", "id", documentId);
        }

        try { Files.deleteIfExists(Paths.get(doc.getPath())); } catch (IOException e) {
            log.warn("Could not delete file from disk: {}", doc.getPath());
        }
        documentRepository.delete(doc);
        log.info("Deleted document {} from contactMessage {}", documentId, contactMessageId);
    }

    private DocumentResponse toDocumentResponse(Document doc) {
        return DocumentResponse.builder()
                .id(doc.getId())
                .filename(doc.getFilename())
                .contentType(doc.getContentType())
                .fileSize(doc.getFileSize())
                .uploadedAt(doc.getUploadedAt())
                .build();
    }
    // ──────────────────────────────────────────────────────────────

    private ContactMessageResponse toResponse(ContactMessage message) {
        return ContactMessageResponse.builder()
                .id(message.getId())
                .name(message.getName())
                .email(message.getEmail())
                .message(message.getMessage())
                .hrAdminName(message.getHrAdminName())
                .companyDetails(message.getCompanyDetails())
                .status(message.getStatus())
                .inquiryMessage(message.getInquiryMessage())
                .rejectionReason(message.getRejectionReason())
                .rejectedAt(message.getRejectedAt())
                .approvedAt(message.getApprovedAt())
                .approvedOrganizationId(message.getApprovedOrganizationId())
                .createdAt(message.getCreatedAt())
                .build();
    }

    // ──────────────────────────────────────────────────────────────
    //  Email builders
    // ──────────────────────────────────────────────────────────────

    private String buildRejectionEmailHtml(ContactMessage message) {
        String reasonBlock = "";
        if (message.getRejectionReason() != null && !message.getRejectionReason().isBlank()) {
            reasonBlock = EmailTemplate.infoBox("Reason", EmailTemplate.escape(message.getRejectionReason()));
        }

        String content = EmailTemplate.paragraph("Dear <strong>" + EmailTemplate.escape(message.getName()) + "</strong>,")
                + EmailTemplate.paragraph("After careful review of your organization registration request, we regret to inform you that your application has been <strong>rejected</strong>.")
                + EmailTemplate.paragraph("If you believe this decision was made in error or would like to reapply with additional information, please contact our support team.")
                + reasonBlock;
        return EmailTemplate.render("Registration Decision", content);
    }

    private String buildInquiryEmailHtml(ContactMessage message, String inquiryMessage, String revisionLink) {
        String content = EmailTemplate.paragraph("Dear <strong>" + EmailTemplate.escape(message.getName()) + "</strong>,")
                + EmailTemplate.paragraph("We are reviewing your organization registration request and require some additional information before we can proceed.")
                + EmailTemplate.infoBox("Question from our team", EmailTemplate.escape(inquiryMessage))
                + EmailTemplate.paragraph("Please click the button below to update your registration details and resubmit for review.")
                + EmailTemplate.button(revisionLink, "Update My Registration")
                + EmailTemplate.fallbackLink(revisionLink);
        return EmailTemplate.render("Information Required", content, "This message was sent because you submitted an organization registration request.");
    }

    private String buildApprovalEmailHtml(ContactMessage message, OrganizationResponse org, String setupLink) {
        String setupBlock = "";
        if (setupLink != null) {
            setupBlock = EmailTemplate.paragraph("Your Organization Admin account has been created. Click the button below to set up your password and activate your account.")
                    + EmailTemplate.button(setupLink, "Set Up My Account")
                    + EmailTemplate.fallbackLink(setupLink);
        } else {
            setupBlock = EmailTemplate.paragraph("Your Organization Admin setup instructions will be sent separately.");
        }

        String content = EmailTemplate.paragraph("Dear <strong>" + EmailTemplate.escape(message.getName()) + "</strong>,")
                + EmailTemplate.paragraph("Good news! Your organization registration request for <strong>" + EmailTemplate.escape(org.getName()) + "</strong> has been <strong>approved</strong>.")
                + setupBlock;
        return EmailTemplate.render("Registration Approved", content);
    }
}
