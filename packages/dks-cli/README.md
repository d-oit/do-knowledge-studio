# dks-cli — Read-Only OKF Bundle Operator CLI

`dks` exposes deterministic Knowledge Studio capabilities over an exported
OKF v0.2 bundle: BM25 search, entity/claim/alias/relation inspection, graph
neighborhoods and paths, bundle diagnostics, encrypted backup verification,
and Portable Agent Skills validation. It is useful to humans, coding agents,
shell scripts and CI.

Read-only by design: the CLI never writes to the bundle it inspects. It needs
no MCP server, agent host, network access, or running app.

## Install

```bash
pnpm install
pnpm --filter dks-cli build
node packages/dks-cli/dist/bin.js help
# optional: pnpm --filter dks-cli link --global, then `dks help`
```

Node.js 22.12+ is required.

## Bundle resolution

Every corpus command resolves the bundle in this order:

1. `--bundle <path>`
2. `DKS_BUNDLE` environment variable
3. `./knowledge`

A bundle is an OKF directory (or zip) with `index.md` declaring
`okf_version 0.2.x`, one Markdown file per concept, and an optional
`.agents/skills/` tree.

## Commands

| Command | Purpose |
| --- | --- |
| `dks help [command]` | Flag and command inventory |
| `dks version` | CLI, package, and Node versions |
| `dks doctor` | Bundle presence, declared version, counts, engine health |
| `dks search <query...>` | BM25 over entities and claims |
| `dks entity <id>` | Entity with claims and resolved relations |
| `dks claims <entityId>` | The entity's claims |
| `dks aliases <id>` | The entity's aliases |
| `dks relations <id>` | Related ids with resolved names |
| `dks graph neighbors <id> [--depth n<=3]` | Neighborhood nodes and edges |
| `dks graph path <from> <to>` | Shortest relation path |
| `dks graph stats` | Node/edge counts, type breakdown, orphans |
| `dks index` | Entity ids and names, paginated by `--limit` |
| `dks backup verify <archive>` | Verify a `.dksb` archive (optionally `--passphrase-env VAR`) |
| `dks skills list` | Discover `.agents/skills` entries |
| `dks skills validate [name]` | Frontmatter, name, description, and reference checks |
| `dks skills test` | Run every skill check and report per-skill findings |
| `dks export [--format json]` | Print the bundle as Markdown (default) or OKF JSON |

`-` in a path placeholder reads stdin, e.g.
`cat backup.dksb | dks backup verify -`.

## Output contract

`--format json` prints exactly one envelope to stdout; human text is the
default. Diagnostics go to stderr, so pipelines can consume stdout directly.

```json
{"ok":true,"data":{"query":"graph","results":[]},"meta":{"command":"search","version":"0.1.0"}}
{"ok":false,"error":{"code":"not_found","message":"...","hint":"..."},"meta":{"command":"entity","version":"0.1.0"}}
```

| Exit code | Meaning |
| --- | --- |
| 0 | Success |
| 2 | Usage or validation failure |
| 3 | Not found |
| 4 | Conflict (e.g. checksum mismatch) |
| 5 | I/O failure |
| 6 | Permission failure (e.g. bad passphrase) |
| 7 | Internal failure |

Other global flags: `--quiet` (suppress stdout on success), `--no-color`
(accepted for pipeline parity), `--limit <n>` (1–200, default 20).

## Filesystem boundary

All disk access goes through the reviewed `FsPort` in `src/fs-port.ts`, the
only module allowed to import `node:fs`. Operator-supplied paths reject empty
strings, NUL bytes, and Windows separators before any filesystem call;
directory walks refuse symlinks. See `plans/217-open-issues-2026-11-17.md`
(LESSON-063) for the Codacy-boundary rationale.

## Development

```bash
pnpm --filter dks-cli typecheck
pnpm --filter dks-cli test
pnpm --filter dks-cli build
```
