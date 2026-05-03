package com.ats.auth.config;

import com.ats.auth.entity.AuthUser;
import com.ats.auth.entity.Role;
import com.ats.auth.repository.AuthUserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class AdminSeeder implements CommandLineRunner {

    private final AuthUserRepository authUserRepository;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    @Override
    public void run(String... args) {
        String adminEmail = "admin@example.com";
        if (authUserRepository.findByEmail(adminEmail).isEmpty()) {
            log.info("Platform admin not found. Seeding default platform admin...");
            AuthUser adminUser = AuthUser.builder()
                    .email(adminEmail)
                    .passwordHash(passwordEncoder.encode("admin123"))
                    .firstName("Platform")
                    .lastName("Admin")
                    .role(Role.ADMIN)
                    .build();
            authUserRepository.save(adminUser);
            log.info("Default platform admin created with email: {}", adminEmail);
        } else {
            log.info("Platform admin already exists.");
        }
    }
}
