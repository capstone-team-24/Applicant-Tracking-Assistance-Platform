CREATE TABLE assessment_invite (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES jobs(id),
    application_id UUID REFERENCES application(id),
    candidate_auth_user_id UUID NOT NULL,
    candidate_email VARCHAR(255),
    job_title VARCHAR(255) NOT NULL,
    assessment_token VARCHAR(255) NOT NULL,
    assessment_title VARCHAR(255),
    time_limit_minutes INTEGER,
    sent_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_assessment_invite_candidate ON assessment_invite(candidate_auth_user_id);
CREATE INDEX idx_assessment_invite_sent_at ON assessment_invite(sent_at);
