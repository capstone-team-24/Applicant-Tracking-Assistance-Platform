-- V5: Add workflow status fields to contact_message table

ALTER TABLE contact_message
    ADD COLUMN IF NOT EXISTS hr_admin_name    VARCHAR(255),
    ADD COLUMN IF NOT EXISTS company_details  TEXT,
    ADD COLUMN IF NOT EXISTS status           VARCHAR(30)  NOT NULL DEFAULT 'PENDING_APPROVAL',
    ADD COLUMN IF NOT EXISTS inquiry_message  TEXT,
    ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
    ADD COLUMN IF NOT EXISTS rejected_at      TIMESTAMP;

-- Backfill: any existing rows that already have approved_at set should be APPROVED
UPDATE contact_message
SET status = 'APPROVED'
WHERE approved_at IS NOT NULL AND status = 'PENDING_APPROVAL';
