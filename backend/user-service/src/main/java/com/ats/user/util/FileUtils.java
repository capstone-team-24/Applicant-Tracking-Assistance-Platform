package com.ats.user.util;

import java.util.Set;

public final class FileUtils {

    private static final Set<String> ALLOWED_CONTENT_TYPES = Set.of(
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "image/png",
            "image/jpeg"
    );

    private static final Set<String> ALLOWED_EXTENSIONS = Set.of(
            "pdf", "doc", "docx", "png", "jpg", "jpeg"
    );

    private FileUtils() {
        // Utility class - prevent instantiation
    }

    /**
     * Sanitize a filename by stripping path traversal characters and special characters.
     * Only allows alphanumeric, hyphens, underscores, dots, and spaces.
     */
    public static String sanitizeFilename(String filename) {
        if (filename == null || filename.isBlank()) {
            return "unnamed_file";
        }

        // Remove path traversal sequences
        String sanitized = filename.replace("..", "")
                .replace("/", "")
                .replace("\\", "");

        // Remove any character that is not alphanumeric, hyphen, underscore, dot, or space
        sanitized = sanitized.replaceAll("[^a-zA-Z0-9.\\-_ ]", "");

        // Trim leading/trailing whitespace and dots
        sanitized = sanitized.strip();
        while (sanitized.startsWith(".")) {
            sanitized = sanitized.substring(1);
        }

        if (sanitized.isBlank()) {
            return "unnamed_file";
        }

        return sanitized;
    }

    /**
     * Check if a content type is allowed for upload.
     */
    public static boolean isAllowedContentType(String contentType) {
        if (contentType == null) {
            return false;
        }
        return ALLOWED_CONTENT_TYPES.contains(contentType.toLowerCase());
    }

    /**
     * Check if a file extension is allowed.
     */
    public static boolean isAllowedExtension(String filename) {
        if (filename == null || !filename.contains(".")) {
            return false;
        }
        String extension = filename.substring(filename.lastIndexOf('.') + 1).toLowerCase();
        return ALLOWED_EXTENSIONS.contains(extension);
    }
}
