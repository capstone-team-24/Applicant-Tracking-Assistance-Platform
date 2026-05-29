ALTER TABLE jobs ADD COLUMN IF NOT EXISTS assigned_to UUID;

UPDATE jobs
SET assigned_to = created_by
WHERE assigned_to IS NULL;

CREATE TABLE IF NOT EXISTS job_recruiter_assignments (
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    recruiter_auth_user_id UUID NOT NULL,
    PRIMARY KEY (job_id, recruiter_auth_user_id)
);

INSERT INTO job_recruiter_assignments (job_id, recruiter_auth_user_id)
SELECT id, assigned_to
FROM jobs
WHERE assigned_to IS NOT NULL
ON CONFLICT DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_job_recruiter_assignments_recruiter
    ON job_recruiter_assignments(recruiter_auth_user_id);
