CREATE TABLE invite_token (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token      UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    email      VARCHAR(255) NOT NULL,
    role       VARCHAR(50)  NOT NULL,
    org_id     UUID         NOT NULL,
    first_name VARCHAR(100),
    last_name  VARCHAR(100),
    expires_at TIMESTAMP    NOT NULL,
    used       BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_invite_token_token ON invite_token(token);
