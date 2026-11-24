# dks-mcp — Optional Read-Only MCP Server

`dks-mcp` is an **optional interoperability adapter**, not a required
interface. The standalone [`dks` CLI](../dks-cli/README.md) is the primary
executable interface for the same data; reach for `dks-mcp` only when your
agent host speaks MCP and cannot run the CLI.

It exposes an exported do-knowledge-studio OKF v0.2 bundle to MCP agent
clients (Claude Code, Cursor, Claude Desktop) over stdio. No network, no
writes, no live sync: point it at a bundle file and it serves what the export
contains. Decision record: [`plans/ADRs/050-mcp-bridge.md`](../../plans/ADRs/050-mcp-bridge.md).

## Install

```bash
pnpm install
pnpm --filter dks-mcp build
```

## Serve a bundle

```bash
node packages/dks-mcp/dist/cli.js serve ~/backups/do-knowledge-studio-okf-2026-11-05.zip
# or a directory of `.md` files:
node packages/dks-mcp/dist/cli.js serve ~/vault-export/
```

The bundle must be a studio OKF export (zip with an `okf-bundle/` prefix or a
plain directory): `index.md` declaring `okf_version 0.2.x`, one `.md` file per
concept, `log.md` ignored. Oversized, malformed, or version-incompatible input
exits non-zero and serves nothing (fail-closed).

## Client configuration

Claude Code:

```bash
claude mcp add dks-mcp -- node /path/to/do-knowledge-studio/packages/dks-mcp/dist/cli.js serve /path/to/bundle.zip
```

Claude Desktop (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "dks-mcp": {
      "command": "node",
      "args": ["/path/to/do-knowledge-studio/packages/dks-mcp/dist/cli.js", "serve", "/path/to/bundle.zip"]
    }
  }
}
```

## Tools

Core tools are read-only:

| Tool | Arguments | Returns |
| --- | --- | --- |
| `search` | `query`, `limit?` (1–50, default 5) | Ranked concepts (bundle-scale BM25-lite, lighter than app search) |
| `get_entity` | `ref` (id or unique name) | Content, sources, related ids, trust tier |
| `get_claims` | `ref`, `verifiedOnly?` | Claims with verification + source provenance |
| `neighborhood` | `ref` | One-hop outgoing/incoming related concepts |
| `find_path` | `from`, `to` | Shortest relation path between two concepts |
| `list_tags` | — | Tag census by usage count |

Opt-in bridge tools (set `DKS_MCP_BRIDGE=propose`; off by default, per ADR 054)
return append-only proposals for studio-side review and never write to the
bundle:

| Tool | Arguments | Returns |
| --- | --- | --- |
| `propose_claim` | `entityRef`, `statement`, `confidence?`, `source?` | Claim proposal (`requiresReview: true`) |
| `propose_entity` | `name`, `type?`, `description?`, `content?`, `tags?` | New-entity proposal |
| `propose_link` | `from`, `to`, `relation` | Relation proposal between two concepts |

Ambiguous names resolve to an error naming the candidate ids; every result
carries `trustTier` (`human-reviewed` only with a `human:` verifier, else
`machine-confirmed`/`unverified`) and source `resource`/`title` where the
bundle records them.

## Trust notes

- **Library content is untrusted data.** Results transport bundle text with
  provenance attached; agents must verify before acting on it. The server never
  executes, renders, or follows bundle content.
- **No writes.** There are no mutation tools; the server performs no filesystem
  writes at runtime.
- Bundle parsing mirrors `src/lib/okf/import.ts` semantics (reserved files,
  `[^id]` footnote join, trust derivation, `# Related` links) without
  importing app code. If the OKF export shape changes, update this reader and
  its fixtures together.
