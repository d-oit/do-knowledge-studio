# ADR 057 — MCP remains an optional adapter

**Status**: Accepted
**Date**: 2026-11-26
**Issue**: [#1160](https://github.com/d-oit/do-knowledge-studio/issues/1160)
**Related**: ADR 050 (read-only MCP bridge), ADR 056 (shared domain services),
Plan 220, Plan 221

## Context

The project direction is Agent Skills + the standalone `dks` CLI backed by
`dks-core`, with MCP as interoperability only. Issue #1160 asks for the
decision to be explicit: which consumers actually need MCP, which capabilities
they need, and what would justify an SDK major migration or, failing that,
deprecation.

Since plan 220 the adapter is thin: `dks-mcp` owns stdio transport, tool
schemas and Zod input validation, and delegates bundle loading, ranking,
traversal and trust to `dks-core` — the same services the CLI uses
(`tests/mcp-cli-parity.test.ts`).

## Decision

1. **MCP stays optional and P3.** The primary interfaces remain Agent Skills and
   `dks`. `dks-mcp` is retained while it costs little and serves hosts that
   cannot spawn the CLI.
2. **No SDK major migration now.** The package pins `@modelcontextprotocol/sdk`
   `^1.32.2`. Upgrade only on a demonstrated need (below).
3. **Read-only by default, proposals opt-in.** The six core tools read the
   bundle; `DKS_MCP_BRIDGE=propose` adds append-only proposal tools that never
   write. Both stay protocol- and boundary-tested.
4. **No domain logic in the adapter.** Any new capability lands in `dks-core`
   first; MCP adds presentation only (ADR 056).

## Consumer register (verified 2026-11-26)

No external consumer has reported an MCP-only requirement to this project, and
there is no telemetry to discover one. The register therefore separates what is
*verified* from what is *documented*:

| Consumer | Evidence | Capabilities required |
| --- | --- | --- |
| SDK client (compatibility test) | Verified in CI — `packages/dks-mcp/src/contract.test.ts` drives a real `@modelcontextprotocol/sdk` `Client` over `InMemoryTransport`: `tools/list`, every read-only tool, proposal tools under the flag, and error results | stdio-equivalent transport, `tools/list`, `tools/call`, JSON text result payloads, error results |
| CLI parity harness | Verified in CI — `tests/mcp-cli-parity.test.ts` runs the MCP tools and CLI core services on one on-disk bundle and asserts identical concepts, ranking, tag census and graph results | no protocol surface; guards the shared-service contract |
| Claude Code | Documented configuration (`claude mcp add … -- node dist/cli.js serve <bundle>`); **not** run against a live host in this repository | stdio server, read-only tool calls, JSON results |
| Claude Desktop | Documented `claude_desktop_config.json` entry; **not** run against a live host | same |
| Cursor | Documented MCP stdio support; **not** verified against a live host | same |

The only capability demanded so far is "an MCP host can read an exported bundle
over stdio". Nothing in the register needs resources, prompts, sampling, HTTP
transport, authentication, or write access.

## Triggers for revisiting

Upgrade the SDK, or widen the surface, only when one of these is demonstrated:

- A supported host drops the protocol version this package negotiates, or a
  verified consumer needs a capability listed above as unused.
- A security advisory or end-of-support notice covers the pinned SDK line.
- A verified consumer needs authenticated or remote transport, which contradicts
  the offline, no-backend contract and needs its own ADR.

An upgrade must land with `contract.test.ts` and the parity harness green;
passing tests are the compatibility evidence, not the version number.

## Deprecation path

If no external consumer is identified by the next annual review
(2027-06-01) or by the next SDK major, whichever comes first, remove the
adapter rather than maintain it indefinitely:

1. Announce removal in the release notes with the replacement path: export an
   OKF bundle, run `dks` commands or load the bundle's portable skills.
2. Delete `packages/dks-mcp`, its README and CI lanes; keep ADR 050 and this
   record as history.
3. No data migration is required — the adapter never owned state.

## Consequences

- Documentation states MCP's supported clients and evidence honestly; see
  `packages/dks-mcp/README.md`.
- The adapter's tests are the retention argument: if the contract or parity
  tests had to be weakened, that is the signal to deprecate, not to patch.
- Issue #1160's "real MCP client" criterion is met by the SDK client contract
  test; a live-host smoke run remains a manual check and is not claimed.
