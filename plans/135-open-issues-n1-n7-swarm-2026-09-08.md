# Plan 135 — Open-Issue Sweep N1–N7 (Swarm Implementation)

**Date**: 2026-09-08
**Type**: Implementation plan / GOAP decomposition
**Scope**: Implement every open GitHub issue (#751–#757) in one PR, CI green,
all review conversations addressed.
**Branch**: `feat/open-issues-n1-n7-swarm`
**Method**: GOAP orchestration + parallel agent swarm; Main owns shared mutation
boundaries (store.ts, i18n registry, package.json/lockfile, integration
compile-fix pass).

## Issue → Feature map

| Issue | Feature | Effort | Deps | Status of prereq |
|---|---|---|---|---|
| #751 | N1 Semantic/multilingual search (embeddings + WASM vector store) | High | F1 | F1 already landed (e88f0e3) |
| #752 | N2 Timeline view | Medium | none | — |
| #753 | N3 @mention entity linking in editor | High | none | — |
| #754 | N4 Rule-based claim extraction (`Assertion: … (Source: …)`) | Medium | none | — |
| #755 | N5 i18n-ready typed string layer | Low-Med | none | — |
| #756 | N6 Fully-offline local LLM (transformers.js) | High | none | — |
| #757 | N7 Extensible entity-type Zod registry | High | none | — |

## Workstreams & file ownership (avoid collisions)

| WS | Owns (create/edit) | Must NOT touch |
|---|---|---|
| N1 (wave 2) | `src/lib/search/*` (new vector/embedding modules + worker integration), semantic UI toggle, its tests | `retrieval.ts` tokenizer internals, `store.ts`, i18n index |
| N2 | `src/components/studio/views/timeline-view.tsx` (+test), nav/view registration (app-shell ViewId switch), own message module | i18n index, store.ts, other views |
| N3 | editor view/mention autocomplete + link writer module (+tests); store APIs only via Main-proposed additions | types.ts/schema.ts (N7-owned), i18n index, package.json |
| N4 | claim parser module + editor/claims-panel integration + tests | types/schema, store.ts internals |
| N5 | `src/lib/i18n/` typed messages + extraction of existing view strings (wave 1 files, then a pass after wave 2) | package.json, new feature files' internals |
| N6 | `src/lib/ai/` new offline provider + transformers runtime singleton + settings UI + tests | package.json (Main installs dep), other providers' internals |
| N7 | `types.ts`/`schema.ts` registry, seed, `type-selector.tsx`, `entity-type-icon.tsx`, graph/mindmap theming, custom-types UI + tests | store.ts, other views |
| Main | shared boundaries: new store APIs, i18n registry wiring, `pnpm add @huggingface/transformers`, integration pass | — |

## Shared contracts

1. **Strings**: no new hardcoded user-facing strings anywhere. Each WS creates
   its own message module `src/lib/i18n/messages/<ws>.ts` (additive exports) and
   NOTIFIES Main (hub) with module name + keys; Main wires the registry index.
   N5 owns extraction of pre-existing strings.
2. **`EntityType`** (N7): built-in union values stay valid for persisted data;
   registry is additive (`EntityType | (string & {})` for the union seam, or a
   separate custom-type map consumed where meta is rendered). N7 must not break
   exhaustive switches without migrating them.
3. **Store APIs**: Main implements any new store action. WS agents propose exact
   signatures via hub; do not edit `store.ts` unless Main assigns the file.
4. **Dependencies**: only Main runs `pnpm add`. `@huggingface/transformers`
   (single dep serving N1 embeddings + N6 decoder). Client-only, dynamic
   import, `ssr: false` where needed.
5. **Validation**: agents skip lint/typecheck/test/build (integration phase
   runs them). Each WS must add unit tests for its own logic and keep files
   ≤500 LOC. No `any`. Named exports only.
6. **Issues**: every PR must reference `Fixes #751 … #757`.
7. **Code-quality rules**: no magic numbers, `catch` blocks must handle errors,
   AbortController on fetches, `useCallback`/`React.memo` for components.

## Execution

- **Wave 1** (parallel): F1 skipped (landed) — N3, N4, N5, N2, N6, N7.
- **Wave 2**: N1 (after wave-1 integration so search worker shape is final).
- **Integration (Main)**: run lint/typecheck/test/build; fix cross-WS breakage;
  wire i18n registry; run `verify-deps.sh`; e2e for editor, search, ai-harness.
- **PR**: single PR `feat: implement open issues N1–N7 (#751–#757)`;
  `Fix #751 #752 #753 #754 #755 #756 #757`.
- **CI + review loop**: `run_watch`; fix failures; respond to every comment;
  resolve review threads (required_review_thread_resolution gate — GraphQL
  resolveReviewThread). Codacy/DeepSource false-positive patterns fixed at code
  level (docs: AGENTS.md, plans/123, LESSON-031/034).
- Do NOT create a GitHub release.

## Quality gates

`pnpm run lint && pnpm run typecheck && pnpm run test && pnpm run build`
(warnings-as-errors); `./scripts/minimal_quality_gate.sh`; `test:coverage` for
data-model/search/export changes; `test:e2e` for UI/editor/graph/search; code
review pass before merge.