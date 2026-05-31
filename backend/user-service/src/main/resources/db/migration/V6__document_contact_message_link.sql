-- V6: Add contact_message_id to document table so documents can be linked
--     to contact-message registrations (not just user profiles)

ALTER TABLE document
    ADD COLUMN IF NOT EXISTS contact_message_id UUID REFERENCES contact_message(id) ON DELETE CASCADE;

-- Make profile_id nullable since documents can now belong to either a profile OR a contact message
ALTER TABLE document
    ALTER COLUMN profile_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_document_contact_message_id ON document(contact_message_id);
