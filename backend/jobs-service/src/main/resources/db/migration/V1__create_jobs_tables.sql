CREATE TYPE job_status AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED', 'ARCHIVED');
CREATE TYPE application_status AS ENUM ('SUBMITTED', 'PARSING', 'PARSED', 'SCREENING', 'SHORTLISTED', 'INTERVIEW', 'OFFERED', 'REJECTED', 'WITHDRAWN');

CREATE TABLE jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    requirements TEXT,
    location VARCHAR(255),
    employment_type VARCHAR(50),
    experience_level VARCHAR(50),
    skills TEXT[],
    custom_scoring_rules JSONB,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    created_by UUID NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    published_at TIMESTAMP,
    closed_at TIMESTAMP
);

CREATE TABLE application (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES jobs(id),
    candidate_auth_user_id UUID,
    candidate_email VARCHAR(255),
    candidate_name VARCHAR(255),
    cover_letter TEXT,
    portfolio_links TEXT[],
    contact_phone VARCHAR(50),
    candidate_profile_snapshot JSONB,
    original_file_path VARCHAR(500),
    original_filename VARCHAR(255),
    status VARCHAR(30) NOT NULL DEFAULT 'SUBMITTED',
    parse_confidence FLOAT,
    composite_score FLOAT,
    ranking_position INTEGER,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE ranking_job (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES jobs(id),
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    result JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP
);

CREATE INDEX idx_jobs_org_id ON jobs(org_id);
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_application_job_id ON application(job_id);
CREATE INDEX idx_application_status ON application(status);
CREATE INDEX idx_application_candidate ON application(candidate_auth_user_id);
CREATE INDEX idx_ranking_job_job_id ON ranking_job(job_id);
