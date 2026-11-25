# ADR 056: Shared domain services across PWA, CLI and optional MCP

**Status**: Accepted
**Date**: 2026-11-22
**Issue**: #1170 (informs #1160, #1161)

## Context

Three runtimes consume the same domain rules — search, graph traversal, OKF
import/validation, export, backup. Duplication drifts: the audit for #1170
(plan 220) found `dks-mcp` carrying a 4th copy of the bundle-safety caps and a
parallel OKF parser plus its own BM25-lite ranking and BFS traversal
(`bundle-reader.ts`, `library-index.ts`), while the CLI already delegates to
`dks-core` (plan 217, PR4a) and the PWA is facade-only.

`dks-core` is a dependency-free workspace package: no React, no Next.js, no
MCP SDK, no `node:fs` at module scope (browser-safe by construction; Node
hosting ships via `dks-cli`'s reviewed `FsPort`).

## Decision

`dks-core` is the single source of truth for domain services and rules. Every
runtime is a thin adapter:

| Runtime | Owns | Never owns |
|---|---|---|
| `dks-core` | domain services, parsers, validators, safety caps, ranking, traversal, ports (`FsPort`, `FsWriterPort`) | I/O of any runtime |
| PWA (`src/`) | React hooks, Zustand slices, IndexedDB/localStorage/BroadcastChannel adapters, rendering (culling, LOD) | search/graph/OKF/backup rules (facades only) |
| CLI (`dks-cli`) | argv parsing, envelopes, exit codes, the Node `FsPort` implementation | domain rules |
| MCP (`dks-mcp`) | stdio server, tool schemas, Zod input validation | domain rules — delegates to the same services the CLI uses |

Extraction rule (#1170's anti-generalization clause): a capability is extracted
into `dks-core` only when two or more real runtimes consume it. Studio-only
persisters (`canonical-storage*`, `cross-tab*`) stay in the PWA behind the
validated-boundary adapters (ADR 028/046); they hold no domain rules that a
second runtime needs today.

## Consequences

- MCP migrations (plan 220 PR B) delete the parallel parser/index; MCP results
  become equivalent to the CLI's for the same inputs (acceptance row 6), and
  its ranking description follows `dks-core`'s pipeline.
- MCP stays optional/P3 per #1160: shared services make the adapter thin enough
  that retaining or deprecating it is a documentation decision, not an
  engineering fork.
- New runtime-facing features land as core services + tests first; adapters add
  presentation only. Services stay unit-testable headless (no browser, no MCP
  runtime).

## Implementation status (2026-11-25)

PR B landed as #1195 (`refactor(dks-mcp): delegate bundle loading and indexing
to dks-core`), closing plan 220's PG4–PG6:

- `dks-mcp/src/bundle-reader.ts` is a Node `FsPort` adapter over
  `loadBundleFromDisk` (~90 LOC); the parallel parser, path guard, version
  check, and fourth copy of the safety caps are gone. `loadBundle` is async.
- `dks-mcp/src/library-index.ts` is deleted; tools, server, and CLI import
  `LibraryIndex` from `dks-core`, so both adapters run the same BM25
  (`pwa-retrieval`) and BFS (`graph-path`) engines.
- `tests/mcp-cli-parity.test.ts` drives both adapter modules on one on-disk
  bundle and asserts identical loaded concepts, identical entity ranking, the
  shared tag census (including the descending name tie-break), and equal
  shortest-path / one-hop-neighborhood results.

Deliberate adaptations that remain (not duplication):

- Each runtime owns its `FsPort` implementation (`dks-cli/src/fs-port.ts`,
  `dks-mcp/src/bundle-reader.ts`). Sharing it would put `node:fs` behind a
  `dks-core` subpath, weakening the browser-safety guarantee this ADR makes; the
  two implementations are small and both are pinned by their own tests.
- MCP folds a concept's claim statements into its search document and returns
  concept hits, while the CLI also returns claim rows. Same engine, different
  adaptation for different consumers; the parity harness scopes its ranking
  assertion to claim-free bundles and both packages test their claim handling.
- MCP tool schemas, Zod validation, and the proposal envelope stay in
  `dks-mcp`: they describe a transport contract, not a domain rule.
