# ADR 050 — Read-Only MCP Bridge via an Offline Bundle Server

**Date**: 2026-11-05

**Status**: Accepted; implementation tracked in Plan 196 / issue #1056

**Related**: Plan 194, ADR 027, ADR 028, `src/lib/okf/*`, `src/lib/ai/tools.ts`

## Context

The studio's AI tools are internal (`src/lib/ai/tools.ts`: `search_library`,
`get_entity_claims`, `get_graph_neighborhood`). External agent clients
(Claude Code, Cursor, Claude Desktop) cannot query a user's local library even
though the OKF bundle export was designed to be agent-readable. Issue #1056
asks for a read-only-by-default MCP bridge and requires a spike comparing:

- **A. Offline CLI MCP server**: `dks-mcp serve <bundle>` reads an exported
  OKF/`.zip` bundle over stdio. No network, no live sync.
- **B. Local bridge**: a localhost process the browser tab reaches over
  WebSocket, forwarding calls to the live Zustand store. Needs a pairing token
  and origin checks.
- **C. Browser-native tool registration** (WebMCP-style) where supported;
  experimental.

## Decision

Implement **A**. B and C are rejected for now:

1. **No required backend** (hard repo rule): B introduces a long-lived local
   server plus a pairing/origin trust ceremony the project must then maintain.
   A is a plain stdio child process spawned by the agent client — when the
   client exits, nothing lingers.
2. **Fail-closed**: A reads a versioned, checksummed-by-format bundle
   (`index.md` must declare `okf_version 0.2.x`; oversized or malformed input
   refuses to start). B must defend a live socket against a hostile page or a
   second local user; C depends on browser APIs that do not exist everywhere.
3. **Smallest blast radius**: A reuses the already-shipped OKF export path, so
   the library never leaves the user's machine in a new format. B and C both
   create new live-read surfaces against mutable store state.

### Threat model (option A)

- **Library content is untrusted data.** Concept bodies and claims may contain
  prompt-injection payloads. The server transports text and labels it as
  library data (tool-result envelope, per-result `source` attribution); it
  never executes, renders, or follows anything in the bundle.
- **Bundle path traversal / zip-slip.** Entry names are sanitized exactly like
  the vault-zip importer: no absolute paths, no `..`, no drive roots, no NUL
  bytes. The studio export's `okf-bundle/` prefix is stripped when present (a
  plain zip of bundle files is also accepted). Decompression is bounded
  (entry count + per-file + total caps); over-limit bundles abort before any
  concept is indexed.
- **No network, no writes.** The server speaks stdio only, exposes no write
  tools in the default configuration, and performs no filesystem writes at
  runtime. Any future write capability is a separate opt-in command with a
  diff/confirmation model (not this plan).
- **Trust surfaced, not invented.** Verification is derived from the concept's
  frontmatter `verified` exactly like `parseOkfBundle` (human verifier ⇒
  `verified`, else `unverified`); sources ride the `[^id]` footnote join. The
  server reports the bundle's trust metadata verbatim and never upgrades it.

### Consequences

- New pnpm workspace package `packages/dks-mcp` (`dks-mcp serve <bundle.zip|dir>`).
  Own dependencies (`@modelcontextprotocol/sdk`, `yaml`, `fflate`, `zod`);
  the SDK does not validate `tools/call` arguments server-side, so every tool
  validates with Zod before touching the index.
- The package's bundle reader **mirrors** `src/lib/okf/import.ts` semantics
  (reserved `index.md`/`log.md`, footnote claim join, trust derivation,
  `# Related` link parsing) but does not import app code: the app is a
  private Next.js package and cannot be a dependency. Drift is contained by
  documenting the mirror points in the package README and by testing against
  fixtures written in the documented bundle format.
- Tools in this plan: `search`, `get_entity`, `get_claims`, `neighborhood`,
  `list_tags`. `find_path` waits for the graph-queries issue (#1058).
- Search ranking is a bundle-scale BM25-lite scorer, not the studio's full
  retrieval pipeline — documented on the tool description so agents cite
  accordingly.
- Root gates are extended minimally: `pnpm test` and `pnpm run typecheck`
  chain the package's own `test`/`typecheck` scripts; `eslint .` already
  covers the new directory.
