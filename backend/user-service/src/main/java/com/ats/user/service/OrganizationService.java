package com.ats.user.service;

import com.ats.user.dto.CreateOrganizationRequest;
import com.ats.user.dto.OrganizationResponse;
import com.ats.user.entity.Organization;
import com.ats.user.exception.ResourceNotFoundException;
import com.ats.user.repository.OrganizationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class OrganizationService {

    private final OrganizationRepository organizationRepository;

    @Transactional
    public OrganizationResponse create(CreateOrganizationRequest request) {
        String policies = request.getOrganizationPolicies();
        if (policies == null || policies.trim().isEmpty()) {
            policies = "{}";
        }

        Organization organization = Organization.builder()
                .name(request.getName())
                .organizationPolicies(policies)
                .build();

        Organization saved = organizationRepository.save(organization);
        log.info("Created organization id={}, name={}", saved.getId(), saved.getName());
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public OrganizationResponse getById(UUID id) {
        Organization org = organizationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Organization", "id", id));
        return toResponse(org);
    }

    @Transactional(readOnly = true)
    public String getNameById(UUID orgId) {
        return organizationRepository.findById(orgId)
                .map(Organization::getName)
                .orElse(null);
    }

    @Transactional(readOnly = true)
    public String getPolicies(UUID orgId) {
        Organization org = organizationRepository.findById(orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Organization", "id", orgId));
        return org.getOrganizationPolicies();
    }

    @Transactional(readOnly = true)
    public Page<OrganizationResponse> getAllOrganizations(Pageable pageable) {
        return organizationRepository.findAll(pageable).map(this::toResponse);
    }

    @Transactional
    public OrganizationResponse updateOrganization(UUID id, CreateOrganizationRequest request) {
        Organization org = organizationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Organization", "id", id));
        org.setName(request.getName());
        org.setOrganizationPolicies(request.getOrganizationPolicies());
        Organization updated = organizationRepository.save(org);
        log.info("Updated organization id={}", updated.getId());
        return toResponse(updated);
    }

    @Transactional
    public OrganizationResponse toggleSuspension(UUID id, boolean suspend) {
        Organization org = organizationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Organization", "id", id));
        org.setIsSuspended(suspend);
        Organization updated = organizationRepository.save(org);
        log.info("Organization id={} suspended={}", updated.getId(), suspend);
        return toResponse(updated);
    }

    private OrganizationResponse toResponse(Organization org) {
        return OrganizationResponse.builder()
                .id(org.getId())
                .name(org.getName())
                .organizationPolicies(org.getOrganizationPolicies())
                .createdAt(org.getCreatedAt())
                .isSuspended(org.getIsSuspended())
                .build();
    }
}
