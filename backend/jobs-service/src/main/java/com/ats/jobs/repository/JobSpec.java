package com.ats.jobs.repository;

import com.ats.jobs.entity.Job;
import com.ats.jobs.enums.JobStatus;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Reusable JPA Specification builder for Job queries.
 * Every filter is optional — only non-null/non-blank values generate a predicate.
 */
public class JobSpec {

    private JobSpec() {}

    /**
     * Build a Specification that ANDs together whichever filters are supplied.
     *
     * @param orgId          restrict to a specific organisation (nullable)
     * @param status         restrict to a specific status (nullable)
     * @param search         case-insensitive substring match on title, description, or requirements (nullable)
     * @param location       case-insensitive substring match on location (nullable)
     * @param employmentType exact match on employment_type column (nullable)
     * @param experienceLevel exact match on experience_level column (nullable)
     */
    public static Specification<Job> withFilters(
            UUID orgId,
            JobStatus status,
            String search,
            String location,
            String employmentType,
            String experienceLevel) {

        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (orgId != null) {
                predicates.add(cb.equal(root.get("orgId"), orgId));
            }

            if (status != null) {
                predicates.add(cb.equal(root.get("status"), status));
            }

            if (search != null && !search.isBlank()) {
                String pattern = "%" + search.toLowerCase() + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("title")),        pattern),
                        cb.like(cb.lower(root.get("description")),  pattern),
                        cb.like(cb.lower(root.get("requirements")), pattern)
                ));
            }

            if (location != null && !location.isBlank()) {
                predicates.add(cb.like(
                        cb.lower(root.get("location")),
                        "%" + location.toLowerCase() + "%"
                ));
            }

            if (employmentType != null && !employmentType.isBlank()) {
                predicates.add(cb.equal(root.get("employmentType"), employmentType));
            }

            if (experienceLevel != null && !experienceLevel.isBlank()) {
                predicates.add(cb.equal(root.get("experienceLevel"), experienceLevel));
            }

            // When listing PUBLISHED jobs, also exclude those whose application
            // deadline has already elapsed. The scheduler will close them eventually,
            // but this predicate handles the window between deadline and next scheduler run.
            if (status == JobStatus.PUBLISHED) {
                LocalDateTime now = LocalDateTime.now();
                predicates.add(cb.or(
                        cb.isNull(root.get("applicationDeadline")),
                        cb.greaterThan(root.get("applicationDeadline"), now)
                ));
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }
}
