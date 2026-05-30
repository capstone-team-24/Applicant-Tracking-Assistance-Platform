DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'application'
          AND column_name = 'is_' || 'wait' || 'listed'
    ) THEN
        EXECUTE 'ALTER TABLE application DROP COLUMN IF EXISTS is_' || 'wait' || 'listed';
    END IF;
END $$;
