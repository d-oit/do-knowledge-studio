-- UP
-- Add CHECK and UNIQUE constraints to existing tables
-- SQLite does not support ALTER TABLE ADD CONSTRAINT, so we recreate tables with constraints.

PRAGMA foreign_keys = OFF;

BEGIN TRANSACTION;

-- Recreate entities with UNIQUE(name)
CREATE TABLE entities_v2 (
    id UUID PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    description TEXT,
    metadata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(name)
);
INSERT INTO entities_v2 SELECT * FROM entities;
DROP TABLE entities;
ALTER TABLE entities_v2 RENAME TO entities;

-- Recreate claims with CHECK constraints
CREATE TABLE claims_v2 (
    id UUID PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
    entity_id UUID NOT NULL,
    statement TEXT NOT NULL,
    evidence TEXT,
    confidence REAL DEFAULT 1.0 CHECK (confidence >= 0 AND confidence <= 1),
    source TEXT,
    verification_status TEXT DEFAULT 'unverified' CHECK (verification_status IN ('unverified', 'verified', 'disputed')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE
);
INSERT INTO claims_v2 SELECT * FROM claims;
DROP TABLE claims;
ALTER TABLE claims_v2 RENAME TO claims;

-- Add missing indexes
CREATE INDEX IF NOT EXISTS idx_claims_verification_status ON claims(verification_status);
CREATE INDEX IF NOT EXISTS idx_notes_entity_id ON notes(entity_id);
CREATE INDEX IF NOT EXISTS idx_web_cache_resolved_at ON web_cache(resolved_at);

COMMIT;

PRAGMA foreign_keys = ON;

-- DOWN
-- Remove constraints by recreating tables without them

PRAGMA foreign_keys = OFF;

BEGIN TRANSACTION;

-- Recreate entities without UNIQUE(name)
CREATE TABLE entities_old (
    id UUID PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    description TEXT,
    metadata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO entities_old SELECT * FROM entities;
DROP TABLE entities;
ALTER TABLE entities_old RENAME TO entities;

-- Recreate claims without CHECK constraints
CREATE TABLE claims_old (
    id UUID PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
    entity_id UUID NOT NULL,
    statement TEXT NOT NULL,
    evidence TEXT,
    confidence REAL DEFAULT 1.0,
    source TEXT,
    verification_status TEXT DEFAULT 'unverified',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE
);
INSERT INTO claims_old SELECT * FROM claims;
DROP TABLE claims;
ALTER TABLE claims_old RENAME TO claims;

-- Drop indexes added in this migration
DROP INDEX IF EXISTS idx_web_cache_resolved_at;
DROP INDEX IF EXISTS idx_notes_entity_id;
DROP INDEX IF EXISTS idx_claims_verification_status;

COMMIT;

PRAGMA foreign_keys = ON;
