package com.ats.jobs.repository;

import com.ats.jobs.entity.AssessmentInvite;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface AssessmentInviteRepository extends JpaRepository<AssessmentInvite, UUID> {

    @Query("select ai from AssessmentInvite ai " +
            "where ai.candidateAuthUserId = :candidateAuthUserId " +
            "order by ai.sentAt desc")
    List<AssessmentInvite> findByCandidateAuthUserIdOrderBySentAtDesc(
            @Param("candidateAuthUserId") UUID candidateAuthUserId,
            Pageable pageable);

    boolean existsByJobIdAndCandidateAuthUserId(UUID jobId, UUID candidateAuthUserId);
}
