-- UP
-- Add source_url column to entities table for persisting source URLs
ALTER TABLE entities ADD COLUMN source_url TEXT;

-- DOWN
-- SQLite does not support DROP COLUMN in older versions, so we recreate the table
CREATE TABLE entities_backup AS SELECT id, name, type, description, metadata, created_at, updated_at FROM entities;
DROP TABLE entities;
ALTER TABLE entities_backup RENAME TO entities;
