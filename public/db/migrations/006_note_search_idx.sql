-- UP
-- Add FTS5 index for notes so the "Notes" filter returns note hits.
CREATE VIRTUAL TABLE IF NOT EXISTS note_search_idx USING fts5(
    content,
    tokenize='porter unicode61',
    detail=none,
    content=''
);

-- DOWN
DROP TABLE IF EXISTS note_search_idx;
