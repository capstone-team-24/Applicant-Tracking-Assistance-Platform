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

import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class OrganizationService {

    private final OrganizationRepository organizationRepository;

    @Transactional
    public OrganizationResponse create(CreateOrganizationRequest request) {
        Organization organization = Organization.builder()
                .name(request.getName())
                .organizationPolicies(request.getOrganizationPolicies())
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
    public String getPolicies(UUID orgId) {
        Organization org = organizationRepository.findById(orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Organization", "id", orgId));
        return org.getOrganizationPolicies();
    }

    private OrganizationResponse toResponse(Organization org) {
        return OrganizationResponse.builder()
                .id(org.getId())
                .name(org.getName())
                .organizationPolicies(org.getOrganizationPolicies())
                .createdAt(org.getCreatedAt())
                .build();
    }
}
