package com.ats.gateway.config;

import com.nimbusds.jose.JWSVerifier;
import com.nimbusds.jose.crypto.RSASSAVerifier;
import com.nimbusds.jose.jwk.JWK;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.http.server.reactive.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.util.AntPathMatcher;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class JwtAuthFilter implements GlobalFilter, Ordered {

    private final JwksManager jwksManager;

    private final AntPathMatcher pathMatcher = new AntPathMatcher();

    private static final List<String> PUBLIC_PATHS = List.of(
            "/auth/**",
            "/api/v1/auth/login",
            "/api/v1/auth/signup",
            "/api/v1/auth/refresh",
            "/api/v1/auth/logout",
            "/api/v1/auth/invite/validate",  // public: validate invite token
            "/api/v1/auth/invite/accept",    // public: accept invite & create account
            "/.well-known/**",
            "/actuator/**",
            "/**/swagger/**",
            "/**/swagger-ui/**",
            "/**/swagger-ui.html",
            "/**/v3/api-docs/**",
            "/**/v3/api-docs",
            "/webjars/**",
            "/api/v1/contact-messages",       // public: anyone can submit a contact form
            "/api/v1/contact-messages/token/**" // public: token-based access for org revision
    );

    // Paths that are accessible without auth but will still process tokens if present
    private static final List<String> OPTIONAL_AUTH_PATHS = List.of(
            "/api/v1/jobs",
            "/api/v1/jobs/{id}"
    );

    @Override
    public int getOrder() {
        return -1;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        String path = exchange.getRequest().getURI().getPath();
        String method = exchange.getRequest().getMethod().name();

        if (isPublicPath(path)) {
            return chain.filter(exchange);
        }

        // Allow GET requests to job listing/detail without requiring auth
        if ("GET".equalsIgnoreCase(method) && isOptionalAuthPath(path)) {
            String authHeader = exchange.getRequest().getHeaders().getFirst(HttpHeaders.AUTHORIZATION);
            if (authHeader != null && authHeader.startsWith("Bearer ")) {
                // Token present - validate it and add headers, but don't block on failure
                return tryValidateAndForward(exchange, chain, authHeader.substring(7));
            }
            // No token - pass through without auth headers
            return chain.filter(exchange);
        }

        String authHeader = exchange.getRequest().getHeaders().getFirst(HttpHeaders.AUTHORIZATION);

        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return onUnauthorized(exchange, "Missing or invalid Authorization header");
        }

        String token = authHeader.substring(7);

        try {
            SignedJWT signedJWT = SignedJWT.parse(token);

            // Verify signature using JWKS (with on-demand refresh if cache is empty)
            JWKSet jwkSet = jwksManager.getOrRefreshJWKSet();
            if (jwkSet == null) {
                log.error("JWKS not available, cannot validate token");
                return onUnauthorized(exchange, "Authentication service unavailable");
            }

            String kid = signedJWT.getHeader().getKeyID();
            JWK matchingKey = jwkSet.getKeyByKeyId(kid);

            if (matchingKey == null) {
                log.warn("No matching key found for kid: {}", kid);
                return onUnauthorized(exchange, "Invalid token signing key");
            }

            RSAKey rsaKey = matchingKey.toRSAKey();
            JWSVerifier verifier = new RSASSAVerifier(rsaKey);

            if (!signedJWT.verify(verifier)) {
                log.warn("JWT signature verification failed");
                return onUnauthorized(exchange, "Invalid token signature");
            }

            // Check expiration
            JWTClaimsSet claims = signedJWT.getJWTClaimsSet();
            Date expirationTime = claims.getExpirationTime();

            if (expirationTime != null && expirationTime.before(new Date())) {
                log.warn("JWT token has expired");
                return onUnauthorized(exchange, "Token has expired");
            }

            // Extract claims and add as headers
            String userId = claims.getSubject();
            Object roleClaim = claims.getClaim("role");
            Object orgClaim = claims.getClaim("org");

            ServerHttpRequest.Builder requestBuilder = exchange.getRequest().mutate();

            if (userId != null) {
                requestBuilder.header("X-User-Id", userId);
            }
            if (roleClaim != null) {
                requestBuilder.header("X-User-Role", roleClaim.toString());
            }
            if (orgClaim != null) {
                requestBuilder.header("X-Org-Id", orgClaim.toString());
            }

            ServerWebExchange mutatedExchange = exchange.mutate()
                    .request(requestBuilder.build())
                    .build();

            return chain.filter(mutatedExchange);

        } catch (Exception e) {
            log.error("JWT validation error: {}", e.getMessage());
            return onUnauthorized(exchange, "Invalid token");
        }
    }

    private boolean isPublicPath(String path) {
        for (String pattern : PUBLIC_PATHS) {
            if (pathMatcher.match(pattern, path)) {
                return true;
            }
        }
        return false;
    }

    private boolean isOptionalAuthPath(String path) {
        // Match /api/v1/jobs exactly (listing)
        if (path.equals("/api/v1/jobs") || path.equals("/api/v1/jobs/")) {
            return true;
        }
        // Match /api/v1/jobs/{uuid} (job detail) but not sub-paths like /api/v1/jobs/{id}/publish
        if (path.startsWith("/api/v1/jobs/")) {
            String remainder = path.substring("/api/v1/jobs/".length());
            // Only match if remainder is a UUID (no further slashes)
            return !remainder.contains("/") && !remainder.isEmpty();
        }
        return false;
    }

    private Mono<Void> tryValidateAndForward(ServerWebExchange exchange, GatewayFilterChain chain, String token) {
        try {
            SignedJWT signedJWT = SignedJWT.parse(token);
            JWKSet jwkSet = jwksManager.getJWKSet();

            if (jwkSet != null) {
                String kid = signedJWT.getHeader().getKeyID();
                JWK matchingKey = jwkSet.getKeyByKeyId(kid);

                if (matchingKey != null) {
                    RSAKey rsaKey = matchingKey.toRSAKey();
                    JWSVerifier verifier = new RSASSAVerifier(rsaKey);

                    if (signedJWT.verify(verifier)) {
                        JWTClaimsSet claims = signedJWT.getJWTClaimsSet();
                        Date expirationTime = claims.getExpirationTime();

                        if (expirationTime == null || !expirationTime.before(new Date())) {
                            // Token is valid - add user headers
                            String userId = claims.getSubject();
                            Object roleClaim = claims.getClaim("role");
                            Object orgClaim = claims.getClaim("org");

                            ServerHttpRequest.Builder requestBuilder = exchange.getRequest().mutate();
                            if (userId != null) requestBuilder.header("X-User-Id", userId);
                            if (roleClaim != null) requestBuilder.header("X-User-Role", roleClaim.toString());
                            if (orgClaim != null) requestBuilder.header("X-Org-Id", orgClaim.toString());

                            ServerWebExchange mutatedExchange = exchange.mutate()
                                    .request(requestBuilder.build())
                                    .build();
                            return chain.filter(mutatedExchange);
                        }
                    }
                }
            }
        } catch (Exception e) {
            log.debug("Optional auth token validation failed: {}", e.getMessage());
        }
        // Token invalid or expired - pass through without auth headers (still allow access)
        return chain.filter(exchange);
    }

    private Mono<Void> onUnauthorized(ServerWebExchange exchange, String message) {
        ServerHttpResponse response = exchange.getResponse();
        response.setStatusCode(HttpStatus.UNAUTHORIZED);
        response.getHeaders().setContentType(MediaType.APPLICATION_JSON);

        String body = "{\"error\":\"Unauthorized\",\"message\":\"" + message + "\"}";
        DataBuffer buffer = response.bufferFactory()
                .wrap(body.getBytes(StandardCharsets.UTF_8));

        return response.writeWith(Mono.just(buffer));
    }
}
