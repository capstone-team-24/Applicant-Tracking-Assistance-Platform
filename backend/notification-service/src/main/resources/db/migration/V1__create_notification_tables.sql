CREATE TABLE notification (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_user_id UUID,
    recipient_email VARCHAR(255),
    type VARCHAR(50) NOT NULL,
    channel VARCHAR(20) NOT NULL DEFAULT 'EMAIL',
    subject VARCHAR(500),
    body TEXT,
    event_type VARCHAR(100),
    event_payload JSONB,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    sent_at TIMESTAMP,
    error_message TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notification_recipient ON notification(recipient_user_id);
CREATE INDEX idx_notification_status ON notification(status);
CREATE INDEX idx_notification_type ON notification(type);
