package com.ats.user.controller;

import com.ats.user.dto.ContactMessageRequest;
import com.ats.user.dto.ContactMessageResponse;
import com.ats.user.dto.DocumentResponse;
import com.ats.user.dto.InquiryRequest;
import com.ats.user.dto.OrganizationResponse;
import com.ats.user.dto.RejectContactMessageRequest;
import com.ats.user.dto.UpdateContactMessageRequest;
import com.ats.user.entity.ContactMessageStatus;
import com.ats.user.service.ContactMessageService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
@Tag(name = "Contact Messages", description = "Endpoints for managing contact messages from potential organizations")
public class ContactMessageController {

    private final ContactMessageService contactMessageService;

    // ──────────────────────────────────────────────────────────────
    //  Public — submit registration request
    // ──────────────────────────────────────────────────────────────

    @PostMapping("/contact-messages")
    @Operation(summary = "Submit an organization registration request (Public)")
    public ResponseEntity<ContactMessageResponse> createContactMessage(
            @Valid @RequestBody ContactMessageRequest request) {
        ContactMessageResponse response = contactMessageService.create(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }


    @GetMapping("/contact-messages/{id}")
    @Operation(summary = "Get a single contact message by ID (Admin)")
    public ResponseEntity<ContactMessageResponse> getContactMessage(@PathVariable UUID id) {
        return ResponseEntity.ok(contactMessageService.getById(id));
    }

    // ──────────────────────────────────────────────────────────────
    //  Public — Get and update by Token (for org revision page)
    // ──────────────────────────────────────────────────────────────

    @GetMapping("/contact-messages/token/{token}")
    @Operation(summary = "Get a single contact message by token (Org revision page)")
    public ResponseEntity<ContactMessageResponse> getContactMessageByToken(@PathVariable String token) {
        return ResponseEntity.ok(contactMessageService.getByRevisionToken(token));
    }

    @PutMapping("/contact-messages/token/{token}")
    @Operation(summary = "Organization updates their registration submission (Public — after receiving inquiry)")
    public ResponseEntity<ContactMessageResponse> updateContactMessageByToken(
            @PathVariable String token,
            @Valid @RequestBody UpdateContactMessageRequest request) {
        ContactMessageResponse response = contactMessageService.updateByOrg(token, request);
        return ResponseEntity.ok(response);
    }

    // ──────────────────────────────────────────────────────────────
    //  Platform Admin — list all messages (with optional status filter)
    // ──────────────────────────────────────────────────────────────

    @GetMapping("/contact-messages")
    @Operation(summary = "Get all contact messages with optional status filter (Platform Admin)")
    public ResponseEntity<Page<ContactMessageResponse>> getAllContactMessages(
            @PageableDefault(size = 20, sort = "createdAt", direction = org.springframework.data.domain.Sort.Direction.DESC) Pageable pageable,
            @RequestParam(required = false) ContactMessageStatus status) {
        Page<ContactMessageResponse> messages = status != null
                ? contactMessageService.getMessagesByStatus(status, pageable)
                : contactMessageService.getAllMessages(pageable);
        return ResponseEntity.ok(messages);
    }

    // ──────────────────────────────────────────────────────────────
    //  Platform Admin — approve
    // ──────────────────────────────────────────────────────────────

    @PostMapping("/contact-messages/{id}/approve")
    @Operation(summary = "Approve a registration request — creates org and sends setup-link email (Platform Admin)")
    public ResponseEntity<OrganizationResponse> approveContactMessage(@PathVariable UUID id) {
        return ResponseEntity.ok(contactMessageService.approve(id));
    }

    // ──────────────────────────────────────────────────────────────
    //  Platform Admin — reject
    // ──────────────────────────────────────────────────────────────

    @PostMapping("/contact-messages/{id}/reject")
    @Operation(summary = "Reject a registration request and send rejection email (Platform Admin)")
    public ResponseEntity<ContactMessageResponse> rejectContactMessage(
            @PathVariable UUID id,
            @RequestBody(required = false) RejectContactMessageRequest request) {
        return ResponseEntity.ok(contactMessageService.reject(id, request));
    }

    // ──────────────────────────────────────────────────────────────
    //  Platform Admin — send inquiry
    // ──────────────────────────────────────────────────────────────

    @PostMapping("/contact-messages/{id}/inquiry")
    @Operation(summary = "Send an inquiry to the organization with a revision link (Platform Admin)")
    public ResponseEntity<ContactMessageResponse> sendInquiry(
            @PathVariable UUID id,
            @Valid @RequestBody InquiryRequest request) {
        return ResponseEntity.ok(contactMessageService.sendInquiry(id, request));
    }

    // ──────────────────────────────────────────────────────────────
    //  Documents — upload, list, download, delete
    // ──────────────────────────────────────────────────────────────

    @PostMapping(value = "/contact-messages/{id}/documents", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Upload a verification document for a registration submission (Public)")
    public ResponseEntity<DocumentResponse> uploadDocument(
            @PathVariable UUID id,
            @RequestParam("file") MultipartFile file) {
        DocumentResponse response = contactMessageService.uploadDocument(id, file);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/contact-messages/{id}/documents")
    @Operation(summary = "List verification documents for a submission (Admin or Org)")
    public ResponseEntity<List<DocumentResponse>> listDocuments(@PathVariable UUID id) {
        return ResponseEntity.ok(contactMessageService.listDocuments(id));
    }

    @GetMapping("/contact-messages/{id}/documents/{docId}")
    @Operation(summary = "Download / open a verification document (Admin)")
    public ResponseEntity<Resource> downloadDocument(
            @PathVariable UUID id,
            @PathVariable UUID docId) {
        return contactMessageService.downloadDocument(id, docId);
    }

    @DeleteMapping("/contact-messages/{id}/documents/{docId}")
    @Operation(summary = "Delete a verification document (Admin)")
    public ResponseEntity<Void> deleteDocument(
            @PathVariable UUID id,
            @PathVariable UUID docId) {
        contactMessageService.deleteDocument(id, docId);
        return ResponseEntity.noContent().build();
    }

    // ──────────────────────────────────────────────────────────────
    //  Public Documents by Token
    // ──────────────────────────────────────────────────────────────

    @PostMapping(value = "/contact-messages/token/{token}/documents", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Upload a verification document by token (Public)")
    public ResponseEntity<DocumentResponse> uploadDocumentByToken(
            @PathVariable String token,
            @RequestParam("file") MultipartFile file) {
        DocumentResponse response = contactMessageService.uploadDocumentByToken(token, file);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/contact-messages/token/{token}/documents")
    @Operation(summary = "List verification documents by token (Public)")
    public ResponseEntity<List<DocumentResponse>> listDocumentsByToken(@PathVariable String token) {
        return ResponseEntity.ok(contactMessageService.listDocumentsByToken(token));
    }

    @DeleteMapping("/contact-messages/token/{token}/documents/{docId}")
    @Operation(summary = "Delete a verification document by token (Public)")
    public ResponseEntity<Void> deleteDocumentByToken(
            @PathVariable String token,
            @PathVariable UUID docId) {
        contactMessageService.deleteDocumentByToken(token, docId);
        return ResponseEntity.noContent().build();
    }
}
