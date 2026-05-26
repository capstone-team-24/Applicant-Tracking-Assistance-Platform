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
                .organizationPolicies(buildOrganizationPolicies(message))
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

    private String buildOrganizationPolicies(ContactMessage message) {
        return String.format(
                "{\"sourceContactMessageId\":\"%s\",\"sourceContactName\":\"%s\",\"sourceContactEmail\":\"%s\",\"hrAdminName\":\"%s\"}",
                message.getId(),
                message.getName().replace("\"", "\\\""),
                message.getEmail().replace("\"", "\\\""),
                message.getHrAdminName() != null ? message.getHrAdminName().replace("\"", "\\\"") : ""
        );
    }

    // ──────────────────────────────────────────────────────────────
    //  Email builders
    // ──────────────────────────────────────────────────────────────

    private String buildRejectionEmailHtml(ContactMessage message) {
        String reasonBlock = "";
        if (message.getRejectionReason() != null && !message.getRejectionReason().isBlank()) {
            reasonBlock = "<tr><td style='padding:20px 40px;'>"
                    + "<p style='margin:0 0 8px 0;font-size:13px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;'>Reason</p>"
                    + "<div style='background:#2a1a1a;border-left:4px solid #ef4444;border-radius:4px;padding:16px 20px;'>"
                    + "<p style='margin:0;font-size:14px;line-height:1.6;color:#fca5a5;'>"
                    + escapeHtml(message.getRejectionReason())
                    + "</p></div></td></tr>";
        }

        return "<!DOCTYPE html>"
                + "<html lang='en'><head><meta charset='UTF-8'>"
                + "<meta name='viewport' content='width=device-width,initial-scale=1'></head>"
                + "<body style='margin:0;padding:0;background:#0f0f1a;font-family:Inter,Segoe UI,Arial,sans-serif;'>"
                + "<table width='100%' cellpadding='0' cellspacing='0' style='background:#0f0f1a;padding:40px 16px;'>"
                + "<tr><td align='center'>"
                + "<table width='560' cellpadding='0' cellspacing='0' style='max-width:560px;width:100%;background:#1e1e30;"
                + "border-radius:16px;overflow:hidden;border:1px solid #2e2e50;'>"
                // Header
                + "<tr><td style='background:linear-gradient(135deg,#7f1d1d,#991b1b);padding:32px 40px;text-align:center;'>"
                + "<p style='margin:0 0 6px 0;font-size:11px;font-weight:600;letter-spacing:2px;"
                + "text-transform:uppercase;color:#fca5a5;'>Recruitment Platform</p>"
                + "<h1 style='margin:0;font-size:22px;font-weight:700;color:#ffffff;'>Registration Decision</h1>"
                + "</td></tr>"
                // Body
                + "<tr><td style='padding:36px 40px 24px;'>"
                + "<p style='margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#cbd5e1;'>"
                + "Dear <strong>" + escapeHtml(message.getName()) + "</strong>,</p>"
                + "<p style='margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#cbd5e1;'>"
                + "After careful review of your organization registration request, we regret to inform you that your application has been <strong style='color:#f87171;'>rejected</strong>.</p>"
                + "<p style='margin:0;font-size:14px;line-height:1.6;color:#94a3b8;'>"
                + "If you believe this decision was made in error or would like to reapply with additional information, please contact our support team.</p>"
                + "</td></tr>"
                + reasonBlock
                // Footer
                + "<tr><td style='padding:20px 40px 28px;border-top:1px solid #2e2e50;text-align:center;'>"
                + "<p style='margin:0;font-size:11px;color:#334155;'>&#169; ATS Recruitment Platform</p>"
                + "</td></tr>"
                + "</table>"
                + "</td></tr></table>"
                + "</body></html>";
    }

    private String buildInquiryEmailHtml(ContactMessage message, String inquiryMessage, String revisionLink) {
        return "<!DOCTYPE html>"
                + "<html lang='en'><head><meta charset='UTF-8'>"
                + "<meta name='viewport' content='width=device-width,initial-scale=1'></head>"
                + "<body style='margin:0;padding:0;background:#0f0f1a;font-family:Inter,Segoe UI,Arial,sans-serif;'>"
                + "<table width='100%' cellpadding='0' cellspacing='0' style='background:#0f0f1a;padding:40px 16px;'>"
                + "<tr><td align='center'>"
                + "<table width='560' cellpadding='0' cellspacing='0' style='max-width:560px;width:100%;background:#1e1e30;"
                + "border-radius:16px;overflow:hidden;border:1px solid #2e2e50;'>"
                // Header
                + "<tr><td style='background:linear-gradient(135deg,#1e3a5f,#1d4ed8);padding:32px 40px;text-align:center;'>"
                + "<p style='margin:0 0 6px 0;font-size:11px;font-weight:600;letter-spacing:2px;"
                + "text-transform:uppercase;color:#93c5fd;'>Recruitment Platform</p>"
                + "<h1 style='margin:0;font-size:22px;font-weight:700;color:#ffffff;'>Information Required</h1>"
                + "</td></tr>"
                // Body
                + "<tr><td style='padding:36px 40px 24px;'>"
                + "<p style='margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#cbd5e1;'>"
                + "Dear <strong>" + escapeHtml(message.getName()) + "</strong>,</p>"
                + "<p style='margin:0 0 24px 0;font-size:15px;line-height:1.6;color:#cbd5e1;'>"
                + "We are reviewing your organization registration request and require some additional information before we can proceed.</p>"
                // Inquiry message block
                + "<p style='margin:0 0 8px 0;font-size:13px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;'>Question from our team</p>"
                + "<div style='background:#0f1929;border-left:4px solid #3b82f6;border-radius:4px;padding:16px 20px;margin-bottom:28px;'>"
                + "<p style='margin:0;font-size:14px;line-height:1.7;color:#93c5fd;'>"
                + escapeHtml(inquiryMessage)
                + "</p></div>"
                + "<p style='margin:0 0 28px 0;font-size:14px;line-height:1.6;color:#94a3b8;'>"
                + "Please click the button below to update your registration details and resubmit for review.</p>"
                // CTA
                + "<table cellpadding='0' cellspacing='0' style='margin:0 auto 32px auto;'>"
                + "<tr><td align='center' style='background:linear-gradient(135deg,#1d4ed8,#2563eb);border-radius:10px;'>"
                + "<a href='" + revisionLink + "' target='_blank' "
                + "style='display:inline-block;padding:14px 36px;font-size:15px;font-weight:600;"
                + "color:#ffffff;text-decoration:none;letter-spacing:0.3px;'>Update My Registration</a>"
                + "</td></tr></table>"
                // Fallback
                + "<p style='margin:0 0 8px 0;font-size:12px;color:#64748b;'>If the button does not work, copy and paste this link:</p>"
                + "<p style='margin:0;word-break:break-all;'>"
                + "<a href='" + revisionLink + "' style='color:#60a5fa;text-decoration:underline;font-size:12px;'>" + revisionLink + "</a></p>"
                + "</td></tr>"
                // Footer
                + "<tr><td style='padding:20px 40px 28px;border-top:1px solid #2e2e50;text-align:center;'>"
                + "<p style='margin:0 0 6px 0;font-size:12px;line-height:1.6;color:#475569;'>"
                + "This message was sent because you submitted an organization registration request.</p>"
                + "<p style='margin:0;font-size:11px;color:#334155;'>&#169; ATS Recruitment Platform</p>"
                + "</td></tr>"
                + "</table>"
                + "</td></tr></table>"
                + "</body></html>";
    }

    private String escapeHtml(String value) {
        if (value == null) return "";
        return value
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }

    private String buildApprovalEmailHtml(ContactMessage message, OrganizationResponse org, String setupLink) {
        String setupBlock = "";
        if (setupLink != null) {
            setupBlock = "<p style='margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#cbd5e1;'>"
                    + "Your Organization Admin account has been created. Click the button below to set up your password and activate your account.</p>"
                    + "<table cellpadding='0' cellspacing='0' style='margin:0 auto 32px auto;'>"
                    + "<tr><td align='center' style='background:linear-gradient(135deg,#10b981,#059669);border-radius:10px;'>"
                    + "<a href='" + setupLink + "' target='_blank' "
                    + "style='display:inline-block;padding:14px 36px;font-size:15px;font-weight:600;"
                    + "color:#ffffff;text-decoration:none;letter-spacing:0.3px;'>Set Up My Account</a>"
                    + "</td></tr></table>"
                    + "<p style='margin:0 0 8px 0;font-size:12px;color:#64748b;'>If the button does not work, copy and paste this link:</p>"
                    + "<p style='margin:0 0 24px 0;word-break:break-all;'>"
                    + "<a href='" + setupLink + "' style='color:#34d399;text-decoration:underline;font-size:12px;'>" + setupLink + "</a></p>";
        }

        return "<!DOCTYPE html>"
                + "<html lang='en'><head><meta charset='UTF-8'>"
                + "<meta name='viewport' content='width=device-width,initial-scale=1'></head>"
                + "<body style='margin:0;padding:0;background:#0f0f1a;font-family:Inter,Segoe UI,Arial,sans-serif;'>"
                + "<table width='100%' cellpadding='0' cellspacing='0' style='background:#0f0f1a;padding:40px 16px;'>"
                + "<tr><td align='center'>"
                + "<table width='560' cellpadding='0' cellspacing='0' style='max-width:560px;width:100%;background:#1e1e30;"
                + "border-radius:16px;overflow:hidden;border:1px solid #2e2e50;'>"
                // Header
                + "<tr><td style='background:linear-gradient(135deg,#059669,#10b981);padding:32px 40px;text-align:center;'>"
                + "<p style='margin:0 0 6px 0;font-size:11px;font-weight:600;letter-spacing:2px;"
                + "text-transform:uppercase;color:#a7f3d0;'>Recruitment Platform</p>"
                + "<h1 style='margin:0;font-size:22px;font-weight:700;color:#ffffff;'>Registration Approved</h1>"
                + "</td></tr>"
                // Body
                + "<tr><td style='padding:36px 40px 24px;'>"
                + "<p style='margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#cbd5e1;'>"
                + "Dear <strong>" + escapeHtml(message.getName()) + "</strong>,</p>"
                + "<p style='margin:0 0 24px 0;font-size:15px;line-height:1.6;color:#cbd5e1;'>"
                + "Good news! Your organization registration request for <strong>" + escapeHtml(org.getName()) + "</strong> has been <strong style='color:#34d399;'>approved</strong>.</p>"
                + setupBlock
                + "</td></tr>"
                // Footer
                + "<tr><td style='padding:20px 40px 28px;border-top:1px solid #2e2e50;text-align:center;'>"
                + "<p style='margin:0;font-size:11px;color:#334155;'>&#169; ATS Recruitment Platform</p>"
                + "</td></tr>"
                + "</table>"
                + "</td></tr></table>"
                + "</body></html>";
    }
}
