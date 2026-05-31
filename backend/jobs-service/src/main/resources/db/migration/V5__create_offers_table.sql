CREATE TABLE offers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL REFERENCES application(id),
    token VARCHAR(255) NOT NULL UNIQUE,
    sent_by UUID NOT NULL,
    offer_message TEXT NOT NULL,
    salary VARCHAR(255),
    start_date DATE,
    sent_at TIMESTAMP NOT NULL DEFAULT NOW(),
    accepted_at TIMESTAMP,
    declined_at TIMESTAMP,
    decline_reason TEXT
);

CREATE INDEX idx_offers_application_id ON offers(application_id);
CREATE INDEX idx_offers_token ON offers(token);
