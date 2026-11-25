# Plan 220 — Shared Domain Services (#1170, 2026-11-22)

## Task Analysis

**Goal**: one implementation of search, graph traversal, validation, import and
export rules, consumed by the PWA, the `dks` CLI and the optional MCP adapter
(#1170). **Constraint**: no premature generalization — extract only what ≥2
real consumers need. **Complexity**: Medium (4 extraction targets, all
measured, none coupled to React/browser globals).

Ground truth (duplication audit, 2026-11-22):

| # | Drifted implementation | Single source | LOC |
|---|---|---|---|
| 1 | `packages/dks-mcp/src/bundle-reader.ts` — local `splitFrontmatter`, claim parser, `isSafePath`, trust derivation, and a 4th copy of the bundle caps | `dks-core` `okf-parse.ts` / `bundle-load.ts` / `zip.ts` / `types.ts` | ~395 |
| 2 | `packages/dks-mcp/src/library-index.ts` — own BM25-lite (`K1 1.2`, `NAME_WEIGHT 3`) + own BFS `shortestPath` | `dks-core` `library-index.ts` (delegates to `pwa-retrieval` + `graph-path`) | ~243 |
| 3 | `src/lib/okf/trust.ts` tier/staleness rules outside core's exported surface | `dks-core` (needs exported trust helpers) | ~small |
| 4 | `src/lib/import/vault-zip.ts` re-declares `MAX_VAULT_*` mirrors of core zip caps | `dks-core` `types.ts` / `zip.ts` constants | ~0 (constants) |

Already single-sourced (audited, no action): studio search/graph/OKF-export/
backup are thin delegating facades; storage/cross-tab are studio-only plumbing
behind the ADR-028/046 adapters; `graph-culling`/`graph-index`/sync are
rendering/transport, not domain rules.

## Sub-Goals (GOAP)

1. **PG1 — Docs & boundaries** (P0, deps: none): ADR 056 (shared-services
   boundary: core / browser / CLI / MCP), `plans/ARCHITECTURE.md` dependency
   section with the boundary diagram (also feeds #1161).
2. **PG2 — Trust rules into core** (P0, deps: PG1): RESOLVED 2026-11-22 by
   **deletion** — `src/lib/okf/trust.ts` (+ test) had zero production
   consumers; the rule already lives once in core (`okf-parse.deriveTrustTier`,
   consumed by studio import + CLI). Studio-only `isStale` had no consumer at
   all. Anti-generalization clause applied: nothing to extract, dead weight to
   drop.
3. **PG3 — Vault-zip caps import** (P1, deps: none): DONE 2026-11-22 —
   `markdown-import.ts` mirror constants deleted; `vault-zip.ts`/test import
   `MAX_BUNDLE_ZIP_BYTES` / `MAX_BUNDLE_UNCOMPRESSED_BYTES` / `MAX_BUNDLE_ENTRIES`
   from `dks-core` (values were identical; cutover removes the drift risk).
   Import suites green (45 tests).
4. **PG4 — MCP reader delegates to core** (P0, deps: PG2): DONE 2026-11-25 —
   `bundle-reader.ts` is now a Node `FsPort` adapter (92 LOC) whose
   `loadBundle` returns `loadBundleFromDisk(port, target)`. The local
   frontmatter/claim/related parser, path guard, index-version check, and the
   fourth copy of the caps are deleted; `yaml` left the package and `fflate`
   is dev-only (zip fixtures). `loadBundle` is async, so `cli.ts` awaits it.
5. **PG5 — MCP ranking delegates to core** (P0, deps: PG4): DONE 2026-11-25 —
   `library-index.ts` (+ its test) deleted; tools import `LibraryIndex` /
   `DEFAULT_LIMIT` / concept types straight from `dks-core`, so MCP now runs
   the shared BM25 + BFS engines (no adapter shim left to drift). Ranking
   parity with the CLI is intentional (#1170 acceptance row 6) and the
   `search` tool description says so. Limit clamping is the Zod schema's job
   (`1..50`) rather than a second copy inside the index.
6. **PG6 — Verification sweep** (P0, deps: PG2–PG5): DONE 2026-11-25 — root
   gate green (lint/typecheck/test/build) including the MCP package suite
   (17 tests), core suites unchanged, CLI suites unchanged. Studio code was
   not touched in PR B, so the PWA import-surface e2e from PR A still covers
   the only studio-facing delta.

## Strategy

Sequential for PG1 → PG4/PG5 (shared contract first), parallelizable burst for
PG2+PG3. One branch, stacked PRs in the plan-217 pattern (`PR A`: PG1–PG3;
`PR B`: PG4–PG6) — each proposition independently testable and revertable.

## Execution Plan — PR A (this pass)

| Step | Action | Quality gate |
|---|---|---|
| A1 | ADR 056 + ARCHITECTURE boundaries section | doc-consistency; diagram lists all four consumers |
| A2 | PG2 trust extraction | unit tests moved/kept; studio import path e2e|
| A3 | PG3 vault-zip constant import | studio unit tests green; no behavior delta |
| A4 | Full root gate + `test:e2e` | lint/typecheck/test/build + e2e green |
| A5 | PR opened; CI + Codacy zero-new + adversarial review | PR merge rules |

PR B carries PG4–PG6 after PR A lands.

## Execution Plan — PR B (this pass)

| Step | Action | Quality gate |
|---|---|---|
| B1 | PG4: core-backed `loadBundle` + Node `FsPort`; delete local parser/caps | MCP loader suite (8 tests) green; async call site awaited |
| B2 | PG5: drop `library-index.ts`, import core `LibraryIndex` in tools/server/CLI | MCP contract suite green (6 tool calls, bridge gate) |
| B3 | Dependency hygiene: `dks-core` workspace dep; `yaml` removed; `fflate` dev-only | lockfile diff limited to the `dks-mcp` importer |
| B4 | PG6: root gate + e2e decision | lint/typecheck/test/build green; MCP build emits `dist/` |

Result-shape note for MCP consumers: `search` scores now come from the shared
BM25 engine (studio/CLI parity) instead of the deleted BM25-lite copy, and
`list_tags` breaks count ties by name descending. Tool payload shapes are
unchanged.

## Post-merge follow-ups (2026-11-25)

PR B merged as #1195; a docs-only #1196 corrected the MCP README's stale
"BM25-lite" description. Follow-ups landed in the same pass:

- `tests/mcp-cli-parity.test.ts` — cross-adapter harness driving the CLI and
  MCP adapter modules on one on-disk bundle: identical loaded concepts,
  identical entity ranking, shared tag census (with the descending tie-break),
  and equal shortest-path / one-hop-neighborhood results (node order, hop
  count, neighbor set, canonical edges).
- ADR 056 gains an implementation-status section naming the two deliberate
  per-runtime adaptations (own `FsPort`; MCP folds claims into its search doc).
- MCP search limit bounds are named (`SEARCH_LIMIT_MIN`/`_MAX`) so the Zod
  schema and the tool description cannot drift apart.
- Duplication audit after the merge: no caps, parser, trust, ranking, or
  traversal rule remains in `dks-mcp` source; only tool transport validation
  and the Node port, both intentional per ADR 056.

## Duplication audit — post-merge (2026-11-25)

| Surface | Result |
|---|---|
| `dks-mcp` | Clean: parser, caps, trust, ranking, traversal all from `dks-core`. Remaining: Zod/tool schemas (transport) and the Node `FsPort`. |
| `dks-cli` queries/graph/export/backup | Clean: `searchData` → `pwaSearch`; `pathData`/`neighborsData`/`statsData` → `graph-path` + `buildUndirectedAdjacency`; export → `okf-export`/`markdown-export`; backup → `verifyBackupArchive`; bundle loading → `loadBundleFromDisk`. |
| `dks-cli` skills | Reference scanner deliberately mirrors `scripts/agent-surface.py` (canonical Python implementation, no second TS consumer); frontmatter goes through core's `splitFrontmatter`/`parseFrontmatter`. |
| `dks-cli` args | **Drift found and fixed**: `MIN_LIMIT`/`MAX_RANGE_LIMIT`/`DEFAULT_LIMIT` existed but `parseLimit` compared literal `1`/`200` and the hint repeated "default 20 · allowed range 1–200". Both now derive from the constants. |

## Ranking-change measurement (2026-11-25)

Method: the studio seed corpus exported through `dks-core`'s `buildOkfBundle`
and re-parsed by `parseBundleFiles` (8 concepts, 23 claims) — the same input
`dks-mcp serve` consumes. 20 queries (10 concept names + 10 thematic), `limit 5`,
scored by the deleted BM25-lite index (`packages/dks-mcp/src/library-index.ts` at
`eda0a670`) and by `dks-core`'s shared `LibraryIndex`.

| Metric | Value |
|---|---|
| Queries with any result | 18 / 20 |
| Identical top-1 | 15 / 18 |
| Identical result lists | 11 / 20 |
| Mean containment (overlap ÷ shorter list) | 0.967 |
| Mean absolute rank shift (shared ids) | 0.29 |
| Mean result count (old → new) | 3.00 → 3.10 |
| Queries gaining a result the old index lacked | 4 (5 ids) |

Reading: rankings are stable for name-shaped queries; the deltas concentrate on
multi-word intent queries, where stop-word filtering and prefix matching change
the winner — `why does search fail` moves from `triz-contradiction-matrix` to
`semantic-search`. Caveat: the seed corpus is small, so this is a directional
comparison, not a large-bundle benchmark.

## Acceptance mapping (issue #1170)

- Diagram/boundaries → A1; no React/Next/MCP imports in core → checked in A4
  (grep + core typecheck); browser isolation / no IndexedDB in CLI → already
  true via `FsPort` (verified in audit); PWA unchanged → A4 e2e; CLI/MCP
  equivalent results → PG5 contract tests; services testable headless →
  existing core suites; no second search/graph impl → PG5 removes the last one.
