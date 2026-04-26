package com.ats.jobs.repository;

import com.ats.jobs.entity.InterviewBooking;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface InterviewBookingRepository extends JpaRepository<InterviewBooking, UUID> {
    List<InterviewBooking> findByApplicationId(UUID applicationId);
    List<InterviewBooking> findByCandidateAuthUserId(UUID candidateAuthUserId);
    Optional<InterviewBooking> findBySlotId(UUID slotId);
}
