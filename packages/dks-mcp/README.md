# dks-mcp — Offline Read-Only MCP Server

Exposes an exported do-knowledge-studio OKF v0.2 bundle to MCP agent clients
(Claude Code, Cursor, Claude Desktop) over stdio. No network, no writes, no
live sync: point it at a bundle file and it serves what the export contains.

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

## Tools (all read-only)

| Tool | Arguments | Returns |
| --- | --- | --- |
| `search` | `query`, `limit?` (1–50, default 5) | Ranked concepts (bundle-scale BM25-lite, lighter than app search) |
| `get_entity` | `ref` (id or unique name) | Content, sources, related ids, trust tier |
| `get_claims` | `ref`, `verifiedOnly?` | Claims with verification + source provenance |
| `neighborhood` | `ref` | One-hop outgoing/incoming related concepts |
| `list_tags` | — | Tag census by usage count |

Ambiguous names resolve to an error naming the candidate ids; every result
carries `trustTier` (`human-reviewed` only with a `human:` verifier, else
`machine-confirmed`/`unverified`) and source `resource`/`title` where the
bundle records them. `find_path` arrives with the graph-queries issue (#1058).

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
