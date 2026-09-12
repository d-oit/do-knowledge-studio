# Plan 136 — N1–N7 Execution Status & Integration Sweep (2026-09-09)

**Type**: Execution record for the open-issues sprint (#751–#757)
**Branch**: `feat/open-issues-n1-n7-swarm` (HEAD = main tip `19cc398`)

## Status

A prior session implemented the full N1–N7 feature set in the **working tree,
uncommitted** (30 new files + 36 modified tracked files + `@huggingface/transformers@4.2.0`
in package.json/lockfile). No TODOs, no empty files, no lint-config changes.
This plan records the integration-sweep state and dispatch.

## Issues → Feature → Workstream

| Issue | Feature | Key new files | Status |
|---|---|---|---|
| #751 | N1 Semantic/multilingual search | `src/lib/search/vector-store.ts`, `embeddings.ts`, `semantic-search-toggle.tsx`, `search-worker-client.ts` | **VERIFIED GREEN**; semantic runs main-thread (worker dynamic import hangs under Turbopack — product fix below) |
| #752 | N2 Timeline view | `views/timeline-view.tsx`, `views/timeline-helpers.ts`, app-shell/topbar registration | **VERIFIED GREEN** |
| #753 | N3 @mention linking | `lib/editor/mention.ts`, `views/editor-mention-picker.tsx`, editor-view integration | **VERIFIED GREEN** |
| #754 | N4 Claim extraction | `lib/studio/claim-parser.ts`, editor-claims-panel integration | **VERIFIED GREEN** |
| #755 | N5 i18n layer | `lib/i18n/t.ts`, `lib/i18n/messages/*` | **VERIFIED GREEN** |
| #756 | N6 Offline LLM | `lib/ai/local-adapter.ts`, ai types/providers/settings | **VERIFIED GREEN** |
| #757 | N7 Entity-type registry | `lib/studio/entity-types.ts`, types/schema widening, consumers | **VERIFIED GREEN** |

## Integration-sweep error inventory (2026-09-09 baseline)

### Typecheck (12 errors, all widening fallout / seams)

| Site | Error | Fix |
|---|---|---|
| `views/editor-view.tsx:108` | `AnyEntityType` → `EntityType` | Widen draft state to `AnyEntityType` |
| `views/editor-view.test.tsx:323` | `links: never[]` vs `mentioned-in` | Widen test fixture typing (explicit `Entity[]`, never lose intent) |
| `views/timeline-helpers.ts:42` | `TimelineItem.entityType` too narrow | Widen to `AnyEntityType` |
| `components/studio/topbar.tsx:8` | Missing `timeline` in ViewId label Record | Add `timeline` entry |
| `lib/studio/hydration.ts:103` | `PersistedSlice.typeFilter` still `EntityType \| 'all'` | Widen to `AnyEntityType \| 'all'` |
| `lib/studio/store.ts:559` | `Record<EntityType, number>` byType | `Record<string, number>` |
| `components/studio/right-panel.tsx:206` | `ENTITY_TYPE_META[entity.type]` on `AnyEntityType` | `getEntityTypeMeta(entity.type)` |
| `views/home-view.tsx:156` | same | `getEntityTypeMeta(entity.type)` |
| `lib/studio/schema.test-d.ts:19` | `expectTypeOf(result.data.entities).toEqualTypeOf<Entity[]>()` — TS2554 | Investigate why widened `Entity[]` breaks the vitest typecheck assert |

### Lint (2 problems, editor-view.tsx)

| Site | Problem | Fix |
|---|---|---|
| `editor-view.tsx:281` | `useCallback` missing dep `sourceUrl` (error) | Add `sourceUrl` to deps (verify no stale-closure impact) |
| `editor-view.tsx:383` | Ref access during render (`textarea={textareaRef.current}`) (warning) | Pass the ref object; picker reads `.current` in an effect/event, or lift caret measurement into state on open |

### Tests (7 failed across 5 files — full list pending bg_22)

Known so far:
- `__tests__/keyboard-nav.test.tsx:468` — `aria-current` expectation on editor nav button
- `lib/studio/schema.test-d.ts:19` — TS2554 (see above)

## Swarm dispatch (GOAP, wave 1)

Ownership is disjoint; one agent per workstream, edits its own files only,
MUST skip project-wide gates (Main runs them), runs only its own vitest files.

| Agent | Owns | Must fix | Verify |
|---|---|---|---|
| N3Mentions | editor-view.tsx(+test), editor-mention-picker.tsx(+test), lib/editor/mention.ts | lint ×2, type ×2 | `pnpm vitest run src/components/studio/views/editor-view.test.tsx src/components/studio/views/editor-mention-picker.test.tsx src/lib/editor/mention.test.ts` |
| N2Timeline | timeline-view.tsx(+test), timeline-helpers.ts, topbar.tsx, app-shell.tsx(+test) | topbar `timeline` key, TimelineItem widening | timeline tests + topbar/app-shell tests |
| N7Registry | types.ts, schema.ts(+tests), entity-types.ts(+test), right-panel.tsx, home-view.tsx, hydration.ts, store.ts, type-selector, entity-type-icon, schema.test-d.ts | all `AnyEntityType` seams, schema.test-d | `pnpm vitest run src/lib/studio/entity-types.test.ts src/lib/studio/schema.test.ts src/lib/studio/hydration.test.ts src/components/studio/right-panel.test.tsx src/components/studio/views/home-view.test.tsx src/components/studio/views/type-selector.test.tsx src/components/studio/entity-type-icon.test.tsx` |
| N6LocalLLM | lib/ai/local-adapter.ts(+test), ai/types.ts, providers.ts, index.ts, ai-settings | spec compliance | `pnpm vitest run src/lib/ai/local-adapter.test.ts src/lib/ai/providers.test.ts src/lib/ai/types-coverage.test.ts src/lib/studio/ai-settings.test.ts` |
| N4Claims | lib/studio/claim-parser.ts(+test), editor-claims-panel integration | parser contract | `pnpm vitest run src/lib/studio/claim-parser.test.ts src/components/studio/views/editor-claims-panel.test.tsx` |
| N5I18n | lib/i18n/** (index + messages) | registry wiring, string coverage in files it owns | `pnpm vitest run src/lib/i18n/**` (own tests) |
| N1Semantic | lib/search/: vector-store, embeddings, worker wiring, semantic-search-toggle | spec compliance | `pnpm vitest run src/lib/search/vector-store.test.ts src/lib/search/embeddings.test.ts src/lib/search/search-worker.test.ts src/lib/search/retrieval.test.ts` |

Main: integrates after swarm, fixes the ~12 remaining error sites if any agent
missed, runs full quality gate, commits, pushes PR.

## Quality gates (final, Main)

`pnpm run lint && pnpm run typecheck && pnpm run test && pnpm run build`
(warnings-as-errors); `./scripts/minimal_quality_gate.sh`; e2e:
`pnpm run test:e2e` for editor/search/ai surfaces; `./scripts/verify-deps.sh`
(single new dep — verify only).

## Merge order

1. **PR #772** (perf/graph memoize) — checks green; 4 open bot threads
   (3 DeepSource complexity, 1 GitNexus fixture) block the thread-resolution
   gate. Verify code-level state, reply with evidence, resolve threads, merge
   (squash). Independent file ownership (`graph-view.tsx` + tests) from the
   sprint — mergeable first, no conflict with sprint PR (sprint touches
   graph-view.tsx too → rebase sprint PR onto new main after #772 merges).
2. **Sprint PR** `feat: implement open issues N1–N7 (#751–#757)` — after
   #772 lands; rebase onto updated main; CI green; review; resolve all
   threads; squash-merge.

## Not in scope

GitHub release creation; lint-config/biome edits; unrelated refactors.
## Closing state (2026-09-09, pre-commit)

All local gates green on the sprint tree:

- `pnpm run lint` — 0 errors, 0 warnings
- `pnpm run typecheck` — 0 errors
- `pnpm run test` — 166 files, 2564 passed, 1 skipped
- `pnpm run build` — clean (zero warnings; Turbopack build)
- `pnpm run test:coverage` — 86.13% statements

### Integration fixes beyond the swarm

- **N1 semantic search runs on the main thread** (product bug found during
  e2e). The search worker's `import('@huggingface/transformers')` never
  resolves under Turbopack's module-worker bundling (verified in dev **and**
  production builds over a Playwright trace: worker constructor fires, zero
  network requests, promise hangs forever, no error — `SEMANTIC_WORKER_TIMEOUT_MS`
  replay never fires within any user-visible window). The main-thread dynamic
  import resolves in ~250ms. Cutover: `SearchWorkerClient.searchSemantic` now
  calls `semanticSearch` in-process; worker plumbing (SEMANTIC_SEARCH request,
  SEMANTIC_SUCCESS response, `handleWorkerMessageAsync`, `pendingSemanticRequests`,
  `SEMANTIC_WORKER_TIMEOUT_MS`) removed; worker keeps lexical SEARCH/RESET
  (no dynamic imports, works). Regression guard test added: with a Worker
  present, semantic search must NOT post to it.
- **`library-view.test.tsx`** store mock gained `semanticSearchEnabled` /
  `setSemanticSearchEnabled` + a toggle-drives-store test (N1 acceptance).
- **`components/ui/switch.tsx`** restructured so the Radix switch button is a
  44×44 hit target (was 32×18) with the visual track nested inside a `group`
  span — library toggle violated WCAG 2.5.5 (caught by touch-targets e2e).
  Switch tests updated to the new contract.
- `topbar.tsx` dropped a now-redundant `as keyof typeof VIEW_TITLES` cast.

### e2e fixes (test-side unless noted)

1. `semantic-search.spec.ts` — route block covers CDN subdomains
   (`cdn-lfs.huggingface.co`); fallback hint assertion raised to 20s
   (transformers.js takes ~8s to fail its CDN fetches before surfacing the
   embedder error).
2. `editor-mentions.spec.ts` — relation labels scoped to the graph SVG to
   avoid strict-mode collisions with card/edge-list text.
3. `claim-extraction.spec.ts` — dialog/panel scoped assertions; dedupe flow
   now extracts twice (toast "Skipped 1 duplicate" is only emitted on the
   second add).
4. `local-llm.spec.ts` — `<option>` visibility replaced with
   `toHaveCount(1)` / `toHaveAttribute('value', …)` (options in a closed
   native select are never "visible" in Playwright).
5. `touch-targets.spec.ts` — passed after the product switch fix above.

### Merge order (updated)

1. **PR #772** — head `4cf676c` after the complexity fix
   (`GraphEdgeElement` CC 8 → helpers `isEdgeHighlighted`/`EDGE_STROKE`/
   `EdgeRelationLabel`, all ≤ CC 5; 2363 tests green; reply posted to the
   DeepSource complexity thread + resolved). Merge pending CI green.
2. **Sprint PR** — commit the working tree, push, CI green, review, merge.
   Rebase onto the post-#772 main first (graph-view.tsx edge region vs
   sprint's node-meta/legend changes; conflict confined to the import block).
