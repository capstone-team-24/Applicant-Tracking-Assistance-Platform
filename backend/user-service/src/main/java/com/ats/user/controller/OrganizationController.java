package com.ats.user.controller;

import com.ats.user.dto.CreateOrganizationRequest;
import com.ats.user.dto.OrganizationResponse;
import com.ats.user.service.OrganizationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequiredArgsConstructor
@Tag(name = "Organizations", description = "Organization management")
public class OrganizationController {

    private final OrganizationService organizationService;

    @PostMapping("/organizations")
    @Operation(summary = "Create a new organization")
    public ResponseEntity<OrganizationResponse> createOrganization(
            @Valid @RequestBody CreateOrganizationRequest request) {
        OrganizationResponse response = organizationService.create(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/organizations/{id}")
    @Operation(summary = "Get an organization by ID (Platform Admin)")
    public ResponseEntity<OrganizationResponse> getOrganization(@PathVariable UUID id) {
        return ResponseEntity.ok(organizationService.getById(id));
    }

    @GetMapping("/internal/organizations/{orgId}/name")
    @Operation(summary = "Get organization name by ID (internal)")
    public ResponseEntity<String> getOrganizationName(@PathVariable UUID orgId) {
        String name = organizationService.getNameById(orgId);
        if (name == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(name);
    }

    @GetMapping("/organizations")
    @Operation(summary = "Get all organizations (Platform Admin)")
    public ResponseEntity<org.springframework.data.domain.Page<OrganizationResponse>> getAllOrganizations(
            @org.springframework.data.web.PageableDefault(size = 20) org.springframework.data.domain.Pageable pageable) {
        return ResponseEntity.ok(organizationService.getAllOrganizations(pageable));
    }

    @PutMapping("/organizations/{id}")
    @Operation(summary = "Update an organization (Platform Admin)")
    public ResponseEntity<OrganizationResponse> updateOrganization(
            @PathVariable UUID id,
            @Valid @RequestBody CreateOrganizationRequest request) {
        return ResponseEntity.ok(organizationService.updateOrganization(id, request));
    }

    @PutMapping("/organizations/{id}/suspend")
    @Operation(summary = "Suspend or unsuspend an organization (Platform Admin)")
    public ResponseEntity<OrganizationResponse> toggleSuspension(
            @PathVariable UUID id,
            @RequestParam boolean suspend) {
        return ResponseEntity.ok(organizationService.toggleSuspension(id, suspend));
    }
}
