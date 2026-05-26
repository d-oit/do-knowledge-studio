-- UP
-- This matches the current schema in public/db/schema.sql
-- It is skipped for existing databases (already applied)
PRAGMA user_version = 1;

-- DOWN
PRAGMA user_version = 0;
