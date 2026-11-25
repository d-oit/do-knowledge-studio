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
4. **PG4 — MCP reader delegates to core** (P0, deps: PG2): rewrite
   `bundle-reader.ts` over `dks-core` (`bundle-load`/`okf-parse`/`zip`/`types`);
   delete the local parser+caps; `fflate`/`yaml` deps leave `dks-mcp` if
   unreferenced.
5. **PG5 — MCP ranking delegates to core** (P0, deps: PG4): `library-index.ts`
   becomes a thin adapter over core `LibraryIndex`; equivalence asserted in the
   MCP contract tests. Result-shape changes are called out to MCP consumers in
   the PR body (ranking parity with CLI, per #1170 acceptance row 6).
6. **PG6 — Verification sweep** (P0, deps: PG2–PG5): root gate green
   (lint/typecheck/test/build), studio e2e green (import surface touched),
   core tests runnable without browser/MCP runtime (exists), PWA diff-free
   behavior check on import.

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

## Acceptance mapping (issue #1170)

- Diagram/boundaries → A1; no React/Next/MCP imports in core → checked in A4
  (grep + core typecheck); browser isolation / no IndexedDB in CLI → already
  true via `FsPort` (verified in audit); PWA unchanged → A4 e2e; CLI/MCP
  equivalent results → PG5 contract tests; services testable headless →
  existing core suites; no second search/graph impl → PG5 removes the last one.
