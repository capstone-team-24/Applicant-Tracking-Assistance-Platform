-- Ensure interview_invite table exists (may have been created outside of migrations)
CREATE TABLE IF NOT EXISTS interview_invite (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES jobs(id),
    application_id UUID REFERENCES application(id),
    candidate_auth_user_id UUID NOT NULL,
    candidate_email VARCHAR(255),
    job_title VARCHAR(255) NOT NULL,
    oa_score FLOAT,
    scheduling_url VARCHAR(500),
    sent_at TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_interview_invite_candidate ON interview_invite(candidate_auth_user_id);
CREATE INDEX IF NOT EXISTS idx_interview_invite_sent_at ON interview_invite(sent_at);

-- Add application deadline to jobs
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS application_deadline TIMESTAMP;

-- Add expires_at to assessment_invite (OA deadline)
ALTER TABLE assessment_invite ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP;

-- Add expires_at to interview_invite (interview booking deadline)
ALTER TABLE interview_invite ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP;

-- Index for efficient scheduler queries on job deadline
CREATE INDEX IF NOT EXISTS idx_jobs_application_deadline ON jobs(application_deadline) WHERE application_deadline IS NOT NULL;
