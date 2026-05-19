-- Entities: Central subjects (people, concepts, projects)
CREATE TABLE IF NOT EXISTS entities (
    id UUID PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    description TEXT,
    metadata TEXT, -- JSON string
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Claims: Assertions made about entities
CREATE TABLE IF NOT EXISTS claims (
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

-- Notes: Free-form text or documents
CREATE TABLE IF NOT EXISTS notes (
    id UUID PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
    entity_id UUID,
    content TEXT NOT NULL,
    format TEXT DEFAULT 'markdown',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE SET NULL
);

-- Links: Relationships between entities
CREATE TABLE IF NOT EXISTS links (
    id UUID PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
    source_id UUID NOT NULL,
    target_id UUID NOT NULL,
    relation TEXT NOT NULL,
    metadata TEXT, -- JSON string
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (source_id) REFERENCES entities(id) ON DELETE CASCADE,
    FOREIGN KEY (target_id) REFERENCES entities(id) ON DELETE CASCADE
);

-- Graph Snapshots: Saved states of the knowledge graph
CREATE TABLE IF NOT EXISTS graph_snapshots (
    id UUID PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
    name TEXT NOT NULL,
    nodes_json TEXT NOT NULL,
    edges_json TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_graph_snapshots_created_at ON graph_snapshots(created_at);
CREATE INDEX IF NOT EXISTS idx_claims_entity_id ON claims(entity_id);
CREATE INDEX IF NOT EXISTS idx_links_source_id ON links(source_id);
CREATE INDEX IF NOT EXISTS idx_links_target_id ON links(target_id);

-- FTS5 Virtual Table for Search
-- FTS5 Virtual Table for Search using External Content for performance
-- FTS5 Virtual Tables for Search using External Content for performance
-- This avoids data duplication and allows for more efficient incremental re-indexing.
CREATE VIRTUAL TABLE IF NOT EXISTS entity_search_idx USING fts5(
    name,
    description,
    content='entities',
    content_rowid='rowid'
);

CREATE VIRTUAL TABLE IF NOT EXISTS claim_search_idx USING fts5(
    statement,
    content='claims',
    content_rowid='rowid'
);

-- Note: Synchronous triggers are removed to prevent main-thread blocking during writes.
-- Indexing is now handled asynchronously via the application layer / JobCoordinator.
