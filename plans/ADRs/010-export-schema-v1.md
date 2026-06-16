# ADR 010: Knowledge Studio Export Schema v1.0

## Status
PROPOSED (2026-06-16) — Implementation tracked in `plans/040-goap-export-pipeline-and-pr-cleanup-2026-06-16.md`

## Context
Issue #289 identifies that `src/lib/export-core.ts` produces JSON exports via `generateJsonExport()` but:
- The shape is implicit (inferred from `fetchAllExportData` return type)
- No version field — future schema changes are ungoverned
- No import path — exported JSON cannot round-trip back into the studio
- Frontmatter round-trip is missing for Markdown

The studio has grown beyond entities + claims to include a knowledge graph (`GraphNode`, `GraphEdge`), mind maps (`MindMapData`), notes, links, and tags. Each lives in its own table and export module. There is no single canonical shape that captures the full studio state.

## Decision
We will define **`KnowledgeStudioExport` schema v1.0** in `src/lib/export-schema.ts`, validated with Zod:

```ts
import { z } from 'zod';

export const ExportSchemaV1 = z.object({
  version: z.literal('1.0'),
  exportedAt: z.string().datetime(),          // ISO 8601
  metadata: z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    source: z.enum(['browser', 'cli', 'api']).default('browser'),
  }),
  notes: z.array(NoteSchema),
  entities: z.array(EntitySchema),
  claims: z.array(ClaimSchema),
  links: z.array(LinkSchema),
  graph: z.object({
    nodes: z.array(GraphNodeSchema),
    edges: z.array(GraphEdgeSchema),
  }),
  mindMap: MindMapDataSchema.nullable(),
  tags: z.array(z.string()),
});

export type KnowledgeStudioExport = z.infer<typeof ExportSchemaV1>;
```

### Why versioned
- Lets us introduce v1.1 (e.g., add `blockers` field) without breaking existing exports
- `importFromJson()` can refuse unknown versions explicitly
- Mirrors the database migration model in ADR-004

### Why Zod
- Already in dependency tree (Dependabot bumping to 4.4.3 in #320)
- Produces typed inference — no separate `interface` + `validator`
- Errors include path → easy UX messages
- Aligns with `src/lib/validation.ts` existing patterns

### Why single document
- One file = one backup
- Easier to share/email/version-control
- Replaces N separate JSON files per entity

### Why include graph + mind map
- Studio's value is the *connections* — losing them in export is data loss
- Round-trip must reproduce the full state, not just text

## Alternatives Considered
- **Multi-file zip (one per entity)**: More granular, harder to share, no atomicity
- **SQLite dump**: Binary, not human-readable, blocks Markdown round-trip
- **Keep implicit typing**: Status quo — Issue #289 calls this out as a gap
- **Use TypeBox instead of Zod**: Less idiomatic in this codebase; Zod already used

## Consequences

### Positive
- Export → edit → import workflow becomes possible
- Future schema evolution governed by version field
- Round-trip tests can deep-equal the parsed object
- `cli import` command can validate any external JSON before insertion

### Negative
- One more file to maintain (`export-schema.ts`)
- All sub-schemas (`NoteSchema`, `EntitySchema`, etc.) must be defined in one place — risk of duplication with `src/lib/validation.ts`
- Schema changes require bumping to v1.1 (governance cost)

## Implementation Plan
See `plans/040-goap-export-pipeline-and-pr-cleanup-2026-06-16.md`, actions B2, B4.

### Refactor strategy
Reuse Zod schemas from `src/lib/validation.ts` where they exist; define new ones for graph/mind map. Export both runtime validators and inferred types.

### Migration
- Existing JSON exports (no `version` field) treated as v0 → best-effort import with warnings
- New exports always include `version: '1.0'`

## Files Affected
- **NEW** `src/lib/export-schema.ts` — Zod schemas + types
- `src/lib/export-core.ts` — `exportToJson()` / `importFromJson()` use the schema
- `src/features/export/ExportPanel.tsx` — Import button uses `importFromJson()`
- `cli/commands/export.ts` — JSON format uses the schema
- `cli/commands/import.ts` — Validates input with `ExportSchemaV1.parse()`
- `src/lib/export-schema.test.ts` — Round-trip + invalid-version tests

## Verification
- Unit test: `exportToJson(state) → JSON.parse → ExportSchemaV1.parse()` deep-equal
- Unit test: importing `{ version: '2.0' }` throws with clear message
- E2E: export from UI → import via CLI produces identical state
