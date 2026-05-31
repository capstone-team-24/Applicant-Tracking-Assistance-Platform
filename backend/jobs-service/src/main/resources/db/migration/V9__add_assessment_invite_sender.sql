ALTER TABLE assessment_invite
    ADD COLUMN IF NOT EXISTS sent_by_auth_user_id UUID,
    ADD COLUMN IF NOT EXISTS sent_by_email VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_assessment_invite_sender ON assessment_invite(sent_by_auth_user_id);
