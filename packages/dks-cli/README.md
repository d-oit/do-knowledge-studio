# dks-cli — Read-Only OKF Bundle Operator CLI

`dks` exposes deterministic Knowledge Studio capabilities over an exported
OKF v0.2 bundle: BM25 search, entity/claim/alias/relation inspection, graph
neighborhoods and paths, bundle diagnostics, encrypted backup verification,
and Portable Agent Skills validation. It is useful to humans, coding agents,
shell scripts and CI.

Read-only by design: the CLI never writes to the bundle it inspects. It needs
no MCP server, agent host, network access, or running app.

The CLI is the **primary executable interface** to an exported bundle: Agent
Skills invoke it, shared business logic lives in
[`dks-core`](../dks-core/README.md), and MCP
([`dks-mcp`](../dks-mcp/README.md)) is only an optional adapter for MCP-only
clients. See [`plans/ARCHITECTURE.md`](../../plans/ARCHITECTURE.md) for the
canonical architecture document.

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

Every command has a focused page: `dks help <command>` (or `dks <command> --help`)
prints its usage, access class and runnable examples.

`-` in a path placeholder reads stdin, e.g.
`cat backup.dksb | dks backup verify -`.

## Read-only boundary

Every command is non-mutating. `dks` has no write, import, restore, delete or
migrate command, so there is nothing to guard with `--dry-run` and no prompt to
confirm: it reads an OKF bundle and prints results. `backup verify` and the
`skills` commands only read the archive or skill tree they are pointed at.

The browser workspace is **not** reachable from Node. The studio's canonical
corpus lives in browser-owned IndexedDB, so the CLI operates on an exported copy:
make an OKF export in the studio app (or verify a `.dksb` archive) and point
`--bundle` / `DKS_BUNDLE` at it. Live workspace access would need a separate
local-bridge issue; the CLI does not pretend to have it.

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

Other global flags: `--quiet` (suppress stdout on success), `--verbose` (one
`dks verbose:` diagnostic line on stderr; stdout and JSON data are unchanged),
`--no-color` (accepted for pipeline parity), `--limit <n>` (1–200, default 20).

### Schema compatibility policy

`meta.version` carries the CLI build that produced the envelope, so a consumer
can record which contract it parsed against.

- **Additive changes** — a new optional field, command, `error.code`, or exit
  code — ship in a minor version. Consumers must ignore unknown object keys
  and treat an unrecognized `error.code` as a failure with the printed message.
- **Breaking changes** — removing or renaming a field, changing a field's type,
  moving data between `data`/`meta`/`error`, or redefining an existing exit
  code — are never silent. Before 1.0 they are called out in the release notes;
  from 1.0 they require a major version bump.
- **The stream split never moves**: `--format json` writes exactly one JSON
  object to stdout, on success and on failure. Diagnostics — including
  `--verbose` — always go to stderr, so piping stdout stays parseable.
- **Golden tests**: `envelope.test.ts`, `exit-codes.test.ts` and `cli.test.ts`
  pin the shapes above. Editing them is a contract change, not a refactor.

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
