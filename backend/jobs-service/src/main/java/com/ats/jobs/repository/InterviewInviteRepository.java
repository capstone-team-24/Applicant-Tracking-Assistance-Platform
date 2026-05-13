package com.ats.jobs.repository;

import com.ats.jobs.entity.InterviewInvite;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface InterviewInviteRepository extends JpaRepository<InterviewInvite, UUID> {

    @Query("SELECT ii FROM InterviewInvite ii " +
           "WHERE ii.candidateAuthUserId = :candidateAuthUserId " +
           "ORDER BY ii.sentAt DESC")
    List<InterviewInvite> findByCandidateAuthUserIdOrderBySentAtDesc(
            @Param("candidateAuthUserId") UUID candidateAuthUserId,
            Pageable pageable);

    boolean existsByJobIdAndCandidateAuthUserId(UUID jobId, UUID candidateAuthUserId);

    List<InterviewInvite> findByJobIdAndCandidateAuthUserId(UUID jobId, UUID candidateAuthUserId);

    List<InterviewInvite> findByJobId(UUID jobId);
}
