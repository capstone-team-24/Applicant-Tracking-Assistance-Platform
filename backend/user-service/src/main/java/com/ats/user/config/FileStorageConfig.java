package com.ats.user.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

@Configuration
public class FileStorageConfig {

    @Value("${app.storage.base-path:./data/storage}")
    private String basePath;

    public String getBasePath() {
        return basePath;
    }
}
