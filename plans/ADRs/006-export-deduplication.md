# ADR 006: Shared Export Core for Browser and CLI

## Status
IMPLEMENTED (PR #220 — fetchAllExportData extracted, N+1 query fixed, type alignment complete)

## Context
Export logic is currently duplicated between `src/features/export/ExportPanel.tsx` and `cli/index.ts`. Both generate static HTML sites, but with independent implementations. This causes:
- Bug fixes must be applied in two places (see XSS vulnerability needing fixes in both)
- Feature additions are duplicated effort
- Inconsistencies between browser and CLI export output
- N+1 query issue exists in both, requiring double fixes

## Decision
We will extract a **shared export core** module that both paths consume:

1. **`src/lib/export-core.ts`**: Contains all export logic (HTML generation, Markdown serialization, JSON serialization)
2. **Browser wrapper** (`ExportPanel.tsx`): UI over shared core, adds download UX, progress, error states
3. **CLI wrapper** (`cli/index.ts`): Filesystem wrapper over shared core, adds file writing, progress
4. **Format-specific generators**: Separate functions/modules for each export format
5. **Shared types**: All export-related types in `src/lib/export-core.ts`

### Core interface
```typescript
interface ExportOptions {
  format: 'markdown' | 'json' | 'static-site';
  entities: Entity[];
  claims: Claim[];
  notes: Note[];
  links: Link[];
}

interface ExportResult {
  success: boolean;
  files: Array<{ path: string; content: string | Blob }>;
  errors: Array<{ file: string; message: string }>;
}
```

## Alternatives Considered
- **Keep separate implementations**: Simpler now but technical debt grows with each export feature.
- **CLI calls browser API**: Would require running a browser headlessly in CLI, defeating local-first principle.
- **NPM workspace with shared lib**: Over-engineered; a single shared file in `src/lib/` is sufficient.

## Implementation Plan
1. Create `src/lib/export-core.ts`:
   - `generateSiteHtml(entities, claims, notes, links): string`
   - `generateMarkdown(entity, claims): string`
   - `generateJson(entities, claims, notes, links): string`
   - `escapeHtml(text): string` — moved from ADR-002 security.ts (or import from there)
   - Batch query helpers: `getAllClaimsWithNotes()`
2. Update `ExportPanel.tsx` to call `generateSiteHtml()` and `generateJson()`
3. Update `cli/index.ts` to call same functions
4. Remove duplicated HTML generation code from both
5. Add tests for shared export core (`src/lib/__tests__/export-core.test.ts`)

## Consequences
- **Positive**: Single place for export logic — fix once, both paths benefit
- **Positive**: Consistent output between browser and CLI
- **Positive**: N+1 query fix applied once (see G-PERFORMANCE)
- **Positive**: Security fixes applied once (see G-SECURITY)
- **Negative**: Initial refactoring effort to extract shared code
- **Negative**: CLI must import from `src/lib/` — works since CLI runs in Node.js and can import TypeScript source

## Acceptance Criteria
- [x] `src/lib/export-core.ts` contains all export generation logic
- [x] `ExportPanel.tsx` uses shared core (no inline HTML generation)
- [x] `cli/index.ts` uses shared core (no inline HTML generation)
- [x] Both paths produce identical output for the same input (notes now included in site export)
- [x] N+1 batch query integrated into core (CLI markdown uses fetchAllExportData)
- [x] HTML escaping applied in one place (security.ts)
- [x] Tests cover all export formats with sample data (41 tests)
- [x] `npm run typecheck` and `npm test` pass
