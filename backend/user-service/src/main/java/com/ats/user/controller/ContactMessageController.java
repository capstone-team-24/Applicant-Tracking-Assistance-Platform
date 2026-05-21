package com.ats.user.controller;

import com.ats.user.dto.ContactMessageRequest;
import com.ats.user.dto.ContactMessageResponse;
import com.ats.user.dto.OrganizationResponse;
import com.ats.user.service.ContactMessageService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@Tag(name = "Contact Messages", description = "Endpoints for managing contact messages from potential organizations")
public class ContactMessageController {

    private final ContactMessageService contactMessageService;

    @PostMapping("/contact-messages")
    @Operation(summary = "Submit a contact message (Public)")
    public ResponseEntity<ContactMessageResponse> createContactMessage(
            @Valid @RequestBody ContactMessageRequest request) {
        ContactMessageResponse response = contactMessageService.create(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/contact-messages")
    @Operation(summary = "Get all contact messages (Platform Admin)")
    public ResponseEntity<Page<ContactMessageResponse>> getAllContactMessages(
            @PageableDefault(size = 20) Pageable pageable) {
        Page<ContactMessageResponse> messages = contactMessageService.getAllMessages(pageable);
        return ResponseEntity.ok(messages);
    }

    @PostMapping("/contact-messages/{id}/approve")
    @Operation(summary = "Approve a contact message and create an organization (Platform Admin)")
    public ResponseEntity<OrganizationResponse> approveContactMessage(@PathVariable java.util.UUID id) {
        return ResponseEntity.ok(contactMessageService.approve(id));
    }
}
