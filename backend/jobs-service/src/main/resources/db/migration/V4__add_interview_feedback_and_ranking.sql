-- Add new columns to interview_bookings table
ALTER TABLE interview_bookings
ADD COLUMN recruiter_summary TEXT,
ADD COLUMN strengths TEXT,
ADD COLUMN weaknesses TEXT,
ADD COLUMN hire_recommendation VARCHAR(50),
ADD COLUMN final_score NUMERIC(5, 2);

-- Add new columns to application table
ALTER TABLE application
ADD COLUMN oa_score NUMERIC(5, 2),
ADD COLUMN final_ranking_score NUMERIC(5, 2),
ADD COLUMN final_rank INTEGER,
ADD COLUMN is_waitlisted BOOLEAN DEFAULT FALSE;
