package com.ats.auth.repository;

import com.ats.auth.entity.AuthUser;
import com.ats.auth.entity.Role;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface AuthUserRepository extends JpaRepository<AuthUser, UUID> {

    Optional<AuthUser> findByEmail(String email);

    List<AuthUser> findByOrgIdAndRole(UUID orgId, Role role);
}
