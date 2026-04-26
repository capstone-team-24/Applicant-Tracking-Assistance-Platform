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

    @GetMapping("/internal/organizations/{orgId}/policies")
    @Operation(summary = "Get organization policies by ID (internal)")
    public ResponseEntity<String> getOrganizationPolicies(@PathVariable UUID orgId) {
        String policies = organizationService.getPolicies(orgId);
        return ResponseEntity.ok(policies);
    }
}
