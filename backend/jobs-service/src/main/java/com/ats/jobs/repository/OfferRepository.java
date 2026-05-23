package com.ats.jobs.repository;

import com.ats.jobs.entity.Offer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface OfferRepository extends JpaRepository<Offer, UUID> {
    Optional<Offer> findByToken(String token);
    Optional<Offer> findByApplicationId(UUID applicationId);
}
