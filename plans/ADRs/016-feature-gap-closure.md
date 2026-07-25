# ADR 016: Feature-Gap Closure — Import Persistence, Tags, Version History, Search & Chat

## Status
Superseded by Plans 072/073 — import, tags, history, search, and chat features implemented across multiple GOAP waves.

## Context
A read-only audit verified several **incomplete or half-wired features**. The most user-impacting are below (with evidence). Many overlap with GitHub issues tracked in `plans/INDEX.md` (#227, #231–#236).

### Import (high risk — misleading UX)
- CLI `import` **parses but does not persist**, yet logs "Imported …": `cli/commands/export.ts:78-92`. JSON path calls `importFromJson` then only logs counts; Markdown path calls `importMarkdownFiles` then logs counts. No `createEntity/createNote/createClaim/createLink`.
- No **browser import UI** at all: `src/features/export/ExportPanel.tsx:151-219` only exports; `SidebarNav.tsx:38-44` has no Import view.
- OPML import (part of #233) absent.

### Tags / categories (#234 — unimplemented)
- No `tags`/`category` in entity schema (`src/lib/validation.ts:3-12`), no tags table (`public/db/migrations/001_initial.sql:3-84`), no repository methods (`src/db/repository/types.ts`). Frontmatter tags are parsed but not connected to entities.

### Entity version history (#235 — unimplemented)
- Updates overwrite in place: `src/db/repository/entities.ts:180-214` (`UPDATE entities SET … updated_at = CURRENT_TIMESTAMP`). No `entity_versions`/audit table or history methods.

### Search
- **Notes not indexed** as first-class docs although UI offers a "Notes" filter: docs are `'entity' | 'claim'` only (`src/lib/search/progressive.ts:17-23,61-110`; `fts5-hydrator.ts:5-15`) vs filter at `SearchPanel.tsx:15-25`.
- **Semantic toggle doesn't switch mode**: `progressiveSearch` runs semantic regardless once embeddings are ready (`SearchPanel.tsx:184,270-290`; `progressive.ts:292-306`).
- **Graph filtering/node search (#232)** only exists as neighborhood focus (`GraphView.tsx:100-112`); no search/type/relation/degree filters in `GraphControls`.
- Dead CTA: search "Create new entity" has no handler (`SearchPanel.tsx:59-62`).

### Chat (#227 — partial)
- Two divergent chats: main `Chat` view is **"Local search only"** (`src/features/chat/Chat.tsx:37-70`); provider/tool/streaming chat lives in AI Harness (`src/features/ai/useChat.ts:143-230`).
- Citations don't navigate — only `logger.info` (`Chat.tsx:111-116`).
- Rate limiter hook exists but is **not wired** into the send path (`useRateLimiter.ts` unused in `useChat.ts:170-215`).

### Other (documented, deferred)
- Multi-page static export (#236) — currently single HTML file (`export-core.ts:28-125`; `cli/commands/export.ts:27-32`).
- Claims/mentions reconciled on create only, not on entity update (`Editor.tsx:145-160,180-225`).
- Editor lacks image/table/slash-command extensions (`Editor.tsx:51-57`).
- Graph/mind-map undo/redo absent (#231 partial).
- Vestigial `relatedEntities` prop on `MindMapView` (`MindMapView.tsx:16-78`).

## Decision
Close gaps in **dependency order**, persistence-correctness first. Schema changes use the existing migration framework (ADR 004) and are additive/reversible. No required backend (local-first preserved).

### 1. Import persistence (G-IMPORT) — P1, do first
- CLI `import` writes parsed JSON/Markdown into the repository **transactionally**; create missing entities for notes; import links/claims; **reindex FTS5 + Orama**; honor a conflict policy (skip / overwrite / merge, default skip) and a `--dry-run` flag.
- Add a **browser Import UI** (file picker + drag-drop) that runs the same mapping → repository writes → reindex, with progress and error reporting.
- Add OPML parser/mapper to complete #233.
- **Round-trip contract**: `export → import → deep-equal` for JSON; fixture-based parity for Markdown.

### 2. Tags / categories (G-TAGS) — P1
- Migration: `tags` table + `entity_tags` join (many-to-many). Avoid a denormalized CSV column.
- Repository methods: `addTag`, `removeTag`, `getTags`, `getEntitiesByTag`; extend entity validation type.
- UI: tag editor in the editor; tag filter in Library and Search; round-trip tags through import/export.

### 3. Entity version history (G-HISTORY) — P2
- Migration: `entity_versions` (entity_id, snapshot JSON, changed_at, op). Capture previous state on update/delete (write-ahead in the same transaction).
- Repository: `getEntityHistory`, `getVersion`, `restoreVersion`.
- UI: history panel with diff + restore.

### 4. Search completeness (G-SEARCH) — P1
- Add `'note'` search documents; hydrate notes into Orama + FTS5; map note hits to parent entity; reindex on note create/update/delete.
- Pass a `mode: 'keyword' | 'semantic' | 'hybrid'` option into `progressiveSearch`; the toggle controls it; keyword-only skips the semantic stage. Update stage labels.
- Graph filters + node search UI in `GraphControls`: filter by type/relation/degree/verification; node search highlights and centers matches; handle empty filtered state.
- Wire the "Create new entity" CTA → close search, switch to editor, prefill the query.

### 5. Chat coherence (G-CHAT) — P2
- Resolve the two-chat split: either replace the main `Chat` view with `ChatView`/`useChat`, or rename main Chat to "Ask" (local retrieval) and route LLM chat to the AI Harness. One coherent story, shared persistence/citations/settings.
- Wire `useRateLimiter` into the `useChat` send path with cooldown UI.
- Make citations navigate (entity/claim/note → editor via `onEditEntity`); same handler powers the command-palette result open (`CommandPalette.tsx:104-115`).

### 6. Deferred (track as issues, not this wave)
Multi-page static export (#236), claim/mention reconciliation on update, editor image/table/slash commands, graph/mind-map undo/redo (#231), `relatedEntities` prop removal (bundle with the layout cleanup wave).

## Alternatives Considered
- **Denormalized CSV tag column**: rejected — breaks filtering/joins and FTS; use a join table.
- **Soft-delete + diff for history instead of version table**: considered; a dedicated `entity_versions` snapshot table is simpler to query and restore.
- **Keep two separate chats permanently**: rejected — confusing; "Local search only" labeled as Chat misleads users (#227).
- **Leave CLI `import` as a validator**: rejected — it claims to import while writing nothing; either persist or rename to `validate`.

## Consequences
### Positive
- Import actually persists; round-trip integrity guaranteed.
- Tags + version history unlock organization and safety (restore).
- Search covers notes and offers real mode control + graph filtering.
- Single coherent chat story with rate limiting and working citations.

### Negative
- Schema migrations and reindex paths increase surface area; require up/down + round-trip tests.
- Chat unification is a meaningful refactor; cover with tests before changing routing.

## Implementation Notes
- Use the existing migration framework (ADR 004); migrations additive and reversible.
- Keep files under 500 LOC; extract import mappers and tag/version repository modules.
- Local-first preserved — all persistence is SQLite WASM/OPFS; CLI uses the shared repository.
- Verification: round-trip import deep-equal; tag CRUD + filter tests; version restore test; "Notes" filter returns note hits; keyword-only mode skips semantic; rate-limit gate test; citation/CTA/palette open the entity.

## Files Affected (implementation)
- `cli/commands/export.ts` (+ possible `cli/commands/import.ts` split)
- `src/features/export/ExportPanel.tsx` (+ new import UI), `src/components/SidebarNav.tsx`
- `public/db/migrations/*.sql` (tags, entity_versions), `src/db/repository/*`, `src/lib/validation.ts`
- `src/lib/search/progressive.ts`, `src/lib/search/fts5-hydrator.ts`, `src/features/search/SearchPanel.tsx`
- `src/features/graph/GraphControls.tsx`, `src/features/graph/GraphView.tsx`
- `src/features/chat/Chat.tsx`, `src/features/ai/useChat.ts`, `src/features/ai/useRateLimiter.ts`, `src/components/CommandPalette.tsx`
