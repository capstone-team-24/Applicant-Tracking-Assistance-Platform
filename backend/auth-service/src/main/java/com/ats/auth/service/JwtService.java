package com.ats.auth.service;

import com.ats.auth.dto.JwksResponse;
import com.ats.auth.entity.AuthUser;
import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.JWSSigner;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.locks.ReadWriteLock;
import java.util.concurrent.locks.ReentrantReadWriteLock;
import java.util.stream.Collectors;

@Slf4j
@Service
public class JwtService {

    @Value("${jwt.access-ttl-minutes:15}")
    private long accessTtlMinutes;

    @Value("${jwt.refresh-ttl-days:7}")
    private long refreshTtlDays;

    @Value("${jwt.issuer:ats-auth-service}")
    private String issuer;

    @Value("${jwt.audience:ats-platform}")
    private String audience;

    private RSAKey currentKey;
    private RSAKey previousKey;
    private final ReadWriteLock lock = new ReentrantReadWriteLock();

    @PostConstruct
    public void init() {
        try {
            currentKey = generateRsaKey();
            log.info("RSA key pair generated on startup with kid: {}", currentKey.getKeyID());
        } catch (JOSEException e) {
            throw new IllegalStateException("Failed to generate RSA key pair on startup", e);
        }
    }

    public String generateAccessToken(AuthUser user) {
        lock.readLock().lock();
        try {
            Instant now = Instant.now();
            Instant expiry = now.plus(accessTtlMinutes, ChronoUnit.MINUTES);

            JWTClaimsSet.Builder claimsBuilder = new JWTClaimsSet.Builder()
                    .subject(user.getId().toString())
                    .claim("role", user.getRole().name())
                    .jwtID(UUID.randomUUID().toString())
                    .issueTime(Date.from(now))
                    .expirationTime(Date.from(expiry))
                    .issuer(issuer)
                    .audience(audience);

            if (user.getOrgId() != null) {
                claimsBuilder.claim("org", user.getOrgId().toString());
            }

            JWTClaimsSet claims = claimsBuilder.build();

            JWSHeader header = new JWSHeader.Builder(JWSAlgorithm.RS256)
                    .keyID(currentKey.getKeyID())
                    .build();

            SignedJWT signedJWT = new SignedJWT(header, claims);
            JWSSigner signer = new RSASSASigner(currentKey);
            signedJWT.sign(signer);

            return signedJWT.serialize();
        } catch (JOSEException e) {
            throw new RuntimeException("Failed to sign JWT", e);
        } finally {
            lock.readLock().unlock();
        }
    }

    public long getAccessTtlSeconds() {
        return accessTtlMinutes * 60;
    }

    public long getRefreshTtlDays() {
        return refreshTtlDays;
    }

    public void rotateKeys() {
        lock.writeLock().lock();
        try {
            previousKey = currentKey;
            currentKey = generateRsaKey();
            log.info("RSA key rotated. New kid: {}, Previous kid: {}",
                    currentKey.getKeyID(),
                    previousKey != null ? previousKey.getKeyID() : "none");
        } catch (JOSEException e) {
            throw new RuntimeException("Failed to rotate RSA key pair", e);
        } finally {
            lock.writeLock().unlock();
        }
    }

    public JwksResponse getJwks() {
        lock.readLock().lock();
        try {
            List<RSAKey> publicKeys = new ArrayList<>();
            publicKeys.add(currentKey.toPublicJWK());
            if (previousKey != null) {
                publicKeys.add(previousKey.toPublicJWK());
            }
            JWKSet jwkSet = new JWKSet(new ArrayList<>(publicKeys));
            List<Map<String, Object>> keys = jwkSet.getKeys().stream()
                    .map(k -> k.toJSONObject())
                    .collect(Collectors.toList());
            return JwksResponse.builder().keys(keys).build();
        } finally {
            lock.readLock().unlock();
        }
    }

    private RSAKey generateRsaKey() throws JOSEException {
        return new RSAKeyGenerator(2048)
                .keyID(UUID.randomUUID().toString())
                .generate();
    }
}
