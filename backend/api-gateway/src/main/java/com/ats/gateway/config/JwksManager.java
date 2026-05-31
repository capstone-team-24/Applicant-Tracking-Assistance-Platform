package com.ats.gateway.config;

import com.nimbusds.jose.jwk.JWKSet;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.text.ParseException;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;

@Slf4j
@Component
public class JwksManager {

    @Value("${gateway.auth.jwks-uri}")
    private String jwksUri;

    private final AtomicReference<JWKSet> cachedJWKSet = new AtomicReference<>();
    private final AtomicLong lastAttempt = new AtomicLong(0);
    private static final long MIN_RETRY_INTERVAL_MS = 5000; // 5 seconds

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    @PostConstruct
    public void init() {
        // Retry aggressively on startup
        for (int i = 0; i < 5; i++) {
            refreshJWKSet();
            if (cachedJWKSet.get() != null) {
                return;
            }
            log.info("JWKS not available yet, retrying in 3 seconds... (attempt {}/5)", i + 1);
            try {
                Thread.sleep(3000);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return;
            }
        }
    }

    @Scheduled(fixedRate = 300000) // 5 minutes
    public void refreshJWKSet() {
        doRefresh();
    }

    /**
     * Called on-demand when a request needs JWKS but the cache is empty.
     * Rate-limited to avoid hammering the auth service.
     */
    public JWKSet getOrRefreshJWKSet() {
        JWKSet current = cachedJWKSet.get();
        if (current != null) {
            return current;
        }
        long now = System.currentTimeMillis();
        long last = lastAttempt.get();
        if (now - last > MIN_RETRY_INTERVAL_MS && lastAttempt.compareAndSet(last, now)) {
            log.info("JWKS cache empty, attempting on-demand refresh");
            doRefresh();
        }
        return cachedJWKSet.get();
    }

    private void doRefresh() {
        try {
            log.info("Fetching JWKS from {}", jwksUri);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(jwksUri))
                    .GET()
                    .timeout(Duration.ofSeconds(10))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() == 200) {
                JWKSet jwkSet = JWKSet.parse(response.body());
                cachedJWKSet.set(jwkSet);
                log.info("Successfully refreshed JWKS, {} key(s) loaded", jwkSet.getKeys().size());
            } else {
                log.warn("Failed to fetch JWKS, HTTP status: {}. Keeping stale cache.", response.statusCode());
            }
        } catch (ParseException e) {
            log.warn("Failed to parse JWKS response: {}. Keeping stale cache.", e.getMessage());
        } catch (Exception e) {
            log.warn("Failed to connect to JWKS endpoint {}: {}. Keeping stale cache.", jwksUri, e.getMessage());
        }
    }

    public JWKSet getJWKSet() {
        return cachedJWKSet.get();
    }
}
