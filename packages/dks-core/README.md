# dks-core — Shared Domain Core

`dks-core` is the single implementation of Knowledge Studio business logic that
is not attached to React, Next.js, Node APIs, or MCP: one shared TypeScript
domain layer consumed by the web app (facade re-exports), the `dks` CLI, and
reviewed against the optional MCP adapter's bundle reader.

## Modules

| Module | Purpose |
| --- | --- |
| `frontmatter` | YAML frontmatter parsing and splitting |
| `markdown` / `markdown-scan` / `markdown-export` | Markdown parsing, scanning, and export serialization |
| `okf-export` / `okf-parse` | Open Knowledge Format v0.2 bundle serialization and parsing |
| `bundle-load` / `io` / `zip` | Bundle loading from disk/zip, IO helpers |
| `library-index` | In-memory concept index with BM25 search and name resolution |
| `graph-path` | Shortest relation path over the bundle graph |
| `backup` | `.dksb` archive manifest/checksum handling |
| `pwa-retrieval` | PWA retrieval facade re-exports |

No React, Next.js, Node `fs`, or MCP dependencies: browser code consumes the
facade re-exports, the CLI injects its reviewed `FsPort`, and the MCP adapter
mirrors parsing semantics without importing app code.

## Development

```bash
pnpm --filter dks-core typecheck
pnpm --filter dks-core test
pnpm --filter dks-core build
```

See [`plans/ARCHITECTURE.md`](../../plans/ARCHITECTURE.md) for the canonical
architecture document and package boundaries.
