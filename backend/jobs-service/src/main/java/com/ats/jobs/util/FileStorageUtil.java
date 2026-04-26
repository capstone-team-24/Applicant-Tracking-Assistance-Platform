package com.ats.jobs.util;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.UUID;

@Component
public class FileStorageUtil {

    private final String basePath;

    public FileStorageUtil(@Value("${app.storage.base-path}") String basePath) {
        this.basePath = basePath;
    }

    public String sanitizeFilename(String filename) {
        if (filename == null || filename.isBlank()) {
            return "unnamed_file";
        }
        // Remove path separators and special characters
        String sanitized = filename.replaceAll("[/\\\\:*?\"<>|]", "_");
        // Remove leading dots to prevent hidden files
        sanitized = sanitized.replaceFirst("^\\.+", "");
        if (sanitized.isBlank()) {
            return "unnamed_file";
        }
        return sanitized;
    }

    public String storeFile(MultipartFile file, UUID orgId, UUID applicationId) throws IOException {
        String sanitizedFilename = sanitizeFilename(file.getOriginalFilename());
        String storedName = applicationId.toString() + "_" + sanitizedFilename;

        Path directory = Paths.get(basePath, orgId.toString(), "applications");
        Files.createDirectories(directory);

        Path targetPath = directory.resolve(storedName);
        Files.copy(file.getInputStream(), targetPath, StandardCopyOption.REPLACE_EXISTING);

        return targetPath.toString();
    }

    public Path getFilePath(String storedPath) {
        return Paths.get(storedPath);
    }
}
