-- Migration 001 · room kinds (SHARED / PRIVATE)
-- Applied to existing volumes; also folded into 02-schema.sql for fresh boots.
DO $$ BEGIN
    CREATE TYPE task_kind AS ENUM ('SHARED', 'PRIVATE');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS kind task_kind NOT NULL DEFAULT 'SHARED';
