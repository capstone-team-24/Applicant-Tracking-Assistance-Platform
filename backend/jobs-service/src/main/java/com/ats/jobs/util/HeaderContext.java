package com.ats.jobs.util;

import com.ats.jobs.exception.ForbiddenException;
import jakarta.servlet.http.HttpServletRequest;

import java.util.UUID;

public final class HeaderContext {

    private HeaderContext() {
    }

    public static UUID getUserId(HttpServletRequest request) {
        String header = request.getHeader("X-User-Id");
        if (header == null || header.isBlank()) {
            return null;
        }
        return UUID.fromString(header);
    }

    public static String getUserRole(HttpServletRequest request) {
        String header = request.getHeader("X-User-Role");
        return header != null ? header.trim() : null;
    }

    public static UUID getOrgId(HttpServletRequest request) {
        String header = request.getHeader("X-Org-Id");
        if (header == null || header.isBlank()) {
            return null;
        }
        return UUID.fromString(header);
    }

    public static void assertRecruiter(HttpServletRequest request) {
        String role = getUserRole(request);
        if (!"RECRUITER".equalsIgnoreCase(role)) {
            throw new ForbiddenException("Access denied. RECRUITER role is required.");
        }
    }

    public static void assertCandidate(HttpServletRequest request) {
        String role = getUserRole(request);
        if (!"CANDIDATE".equalsIgnoreCase(role)) {
            throw new ForbiddenException("Access denied. CANDIDATE role is required.");
        }
    }

    /**
     * Alias for {@link #getUserId(HttpServletRequest)} kept for semantic clarity where the
     * ID represents the authenticated user (authUserId) rather than an arbitrary user.
     */
    public static UUID getAuthUserId(HttpServletRequest request) {
        return getUserId(request);
    }
}
