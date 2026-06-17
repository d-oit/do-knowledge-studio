# ADR 015: JSDoc-First Documentation Policy for Exported Components

**Status**: 📝 Proposed
**Date**: 2026-06-16
**Source**: Plan 36.2 (Documentation Overhaul) — gap closure via Plan 041
**Deciders**: Engineering

## Context

Plan 36.2 called for JSDoc on every exported React component in `src/features/`, `src/components/`, and `src/app/`. The 2026-05-31 documentation wave landed **6 of 9 docs** (CLI, DATABASE, DEVELOPMENT, LLM-SETUP, REPOSITORY-API, SEARCH) and 1 of 9 (VERSION sync) but **left the JSDoc coverage partial**.

Audit on 2026-06-16 found that 44 exported `.tsx` components exist; the major ones have **no JSDoc**:

- `src/features/graph/GraphView.tsx`
- `src/features/ai/AIHarness.tsx`
- `src/features/search/SearchPanel.tsx`
- `src/features/mindmap/MindMapView.tsx`
- `src/features/editor/Editor.tsx`
- All `src/components/*.tsx` (SidebarNav, ThemeSwitcher, Header, CommandPalette, ErrorBoundary, SyncToggle, DatabaseSettings, MobileDrawer, LoadingSpinner, JobMetrics, Skeletons)

This hurts:
- **IDE intellisense** — tooltips show only the function name, not the purpose
- **Generated docs** — TypeDoc / API extractors output empty pages
- **New contributors** — they have to read the JSX to understand what each component does
- **AI agents** — context quality degrades when scanning `src/features/`

## Decision

Adopt a **JSDoc-First Policy** for all exported React components and complex hooks:

### Required JSDoc block (precede the export)

```typescript
/**
 * GraphView - Interactive knowledge graph visualization.
 *
 * Renders entities as nodes and links as edges using Sigma.js.
 * Supports force-directed, circular, and hierarchical layouts.
 *
 * @param props - Component props
 * @param props.entities - Array of entities to display as nodes
 * @param props.links - Array of links between entities (rendered as edges)
 * @param props.onNodeClick - Callback fired when a node is clicked
 * @param props.focusMode - When true, shows only the selected node's neighborhood
 * @returns The rendered graph component
 */
export function GraphView(props: GraphViewProps): JSX.Element {
  // ...
}
```

### Scope (what must be documented)

| Element | Required? | Minimum JSDoc |
|---------|-----------|---------------|
| Exported `.tsx` default component | **Yes** | Description + `@param` for each prop |
| Exported `.tsx` named component | **Yes** | Description + `@param` for each prop |
| Exported custom hook (`.ts`) | **Yes** | Description + `@param` + `@returns` |
| Exported Zod schema | **Yes** | Description of what is validated |
| Exported utility function | **Yes** | Description + `@param` + `@returns` |
| Exported type/interface | No (use TS types) | Optional `@remarks` for context |
| Internal helpers | No | None required |

### Style rules

1. **Lead with one-line description** — what the component does, not how
2. **Second paragraph: usage context** — when to use it, what it pairs with
3. **`@param` for every prop** — include type and meaning
4. **`@returns` for non-React functions** — skip for components (return is implicit)
5. **No `@example` blocks** — they rot; tests are the source of truth
6. **No `@deprecated`** in initial pass — handle deprecations in a separate PR
7. **Keep total JSDoc < 20 lines per component** — concise, not exhaustive

### Zod schema documentation

```typescript
/**
 * EntitySchema - Validates an entity record from the database.
 *
 * Rules:
 * - `id` must be a non-empty string
 * - `name` must be 1-200 characters
 * - `type` must be one of: 'note', 'concept', 'person', 'project'
 * - `metadata` is parsed JSON; arbitrary key/value pairs allowed
 */
export const EntitySchema = z.object({ ... });
```

## Alternatives

### A. No JSDoc (status quo)
- **Pros**: Zero maintenance, no churn.
- **Cons**: IDE intellisense is empty, generated docs are blank, contributors struggle.

### B. Use a doc-generator like Storybook
- **Pros**: Interactive playground, visual.
- **Cons**: Heavy infrastructure for a local-first app; out of scope per AGENTS.md.

### C. Use TypeScript JSDoc comments inline at usage sites
- **Pros**: Self-documenting call sites.
- **Cons**: Doesn't help the component itself; repeats information.

### D. JSDoc-First on exports (chosen)
- **Pros**: Single source of truth, helps IDE + extractors + humans + AI agents.
- **Cons**: One-time JSDoc pass on 11+ files; 5min per file on average.

## Consequences

### Positive
- IDE intellisense becomes useful (hover shows description + props)
- TypeDoc / API extractors output real content
- AI agents scanning the codebase get higher signal
- New contributors onboard faster

### Negative
- 11+ files need a leading JSDoc block (small, mechanical)
- Slight risk of `GraphView.tsx` going from 456 → ~480 LOC (still under 500 limit; if it creeps over, refactor first)

### Neutral
- `pnpm run typecheck` already validates JSDoc syntax (TS treats `@param` as type info)
- The change does not affect runtime behavior

## Files Affected (initial wave)

### Components (11+)
- `src/features/graph/GraphView.tsx`
- `src/features/ai/AIHarness.tsx`
- `src/features/search/SearchPanel.tsx`
- `src/features/mindmap/MindMapView.tsx`
- `src/features/editor/Editor.tsx`
- `src/components/SidebarNav.tsx`
- `src/components/ThemeSwitcher.tsx`
- `src/components/Header.tsx`
- `src/components/CommandPalette.tsx`
- `src/components/ErrorBoundary.tsx`
- `src/components/SyncToggle.tsx`
- `src/components/DatabaseSettings.tsx`
- `src/components/MobileDrawer.tsx`
- `src/components/LoadingSpinner.tsx`
- `src/components/JobMetrics.tsx`
- `src/components/Skeletons.tsx`

### Schemas (4)
- `src/lib/validation.ts` — `EntitySchema`, `ClaimSchema`, `NoteSchema`, `LinkSchema`

## Verification

```bash
# 1. Each major component file has a leading JSDoc block
for f in src/features/graph/GraphView.tsx \
         src/features/ai/AIHarness.tsx \
         src/features/search/SearchPanel.tsx \
         src/features/mindmap/MindMapView.tsx \
         src/features/editor/Editor.tsx \
         src/components/SidebarNav.tsx \
         src/components/ThemeSwitcher.tsx; do
  if head -1 "$f" | grep -q "^\s*/\*\*"; then
    echo "OK: $f"
  else
    echo "MISSING: $f"
  fi
done

# 2. Schema JSDoc
grep -B2 "export const EntitySchema\|export const ClaimSchema\|export const NoteSchema\|export const LinkSchema" src/lib/validation.ts | head -20

# 3. Typecheck still clean
pnpm run typecheck

# 4. No 500 LOC violations introduced
find src/ -name "*.ts" -o -name "*.tsx" | xargs wc -l | awk '$1 > 500 {print $0}'
# Should output nothing
```

## References

- Plan 36.2 (JSDoc on components) — `plans/36-documentation-overhaul.md`
- Plan 041 (this work) — `plans/041-goap-remaining-gaps-tests-docs-logging-2026-06-16.md`
- Existing JSDoc examples — `src/lib/graph-layout.ts`, `src/lib/llm/encryption.ts`, `src/features/graph/GraphKeyboardNav.ts`
- TypeScript JSDoc reference — https://www.typescriptlang.org/docs/handbook/jsdoc-supported-syntax.html
