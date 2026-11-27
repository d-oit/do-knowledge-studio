# Plan 221 — CLI help pages, MCP decision record, docs reconciliation (#1169, #1160)

**Created**: 2026-11-26
**Issues**: [#1169](https://github.com/d-oit/do-knowledge-studio/issues/1169),
[#1160](https://github.com/d-oit/do-knowledge-studio/issues/1160)
**Decision**: [ADR 057](../ADRs/057-mcp-optional-adapter.md)

## Goal

Close the two remaining CLI/MCP issues with evidence rather than assertions:
every `dks` command carries usage, access class and runnable examples; the MCP
adapter's consumer register and retention/deprecation trigger are recorded; the
plan 214 field-check row states what was actually run and what is still open.

## Waves

| Wave | Goal | Status | Exit criterion | Evidence |
| --- | --- | --- | --- | --- |
| 1 — CLI help | `dks help <command>` and `dks <command> --help` print one command's usage, access class and examples; the read-only/storage boundary is documented | Done | Every `COMMAND_DOCS` entry has `usage`, `access` and ≥1 example, asserted by a test; focused JSON payload identifies `focused` | `packages/dks-cli/src/commands/help.ts`, `cli.test.ts`, `args.test.ts`, `packages/dks-cli/README.md` |
| 2 — MCP decision | Name what MCP consumers exist, what they need, when to upgrade, and how to remove the adapter | Done | Register distinguishes verified (SDK client contract test, CLI parity) from documented-only hosts; upgrade triggers and a dated deprecation path exist | `plans/ADRs/057-mcp-optional-adapter.md`, `packages/dks-mcp/README.md` |
| 3 — Reconciliation | Make `plans/INDEX.md` match plan 214's evidence; remove committed conflict markers from `plans/ARCHITECTURE.md` | Done | INDEX field-check row cites the browser specs and keeps wave 11 open; `plans/ARCHITECTURE.md` has no markers left (plan 138's fenced markers are a quoted historical defect) | `plans/INDEX.md`, `plans/ARCHITECTURE.md` |

## Defect found while reconciling

`plans/ARCHITECTURE.md` was committed on `main` with unresolved merge-conflict
markers: the ADR table offered either ADR 056 **or** ADRs 048/050, so the
canonical architecture document contained a literal conflict. Resolved by
keeping all three rows with their current statuses (048 implemented and
browser-verified, 050 accepted, 056 accepted) and adding 057.

## Caused by the help change

Two existing checks assumed the old shape and were updated, not bypassed:

- `args.test.ts` asserted that `--help` discards the command name; the new
  contract keeps it as the help topic, so `dks search graph --help` shows search
  help instead of the full inventory.
- `scripts/check-doc-consistency.mjs` parsed `COMMAND_DOCS` with a
  one-line-object regex and failed closed once entries gained fields. It now
  reads the `COMMAND_DOCS` block and extracts every `name: 'x'`, still failing if
  it finds none.

## Limits

- Live MCP hosts (Claude Code, Claude Desktop, Cursor) were not launched; the
  compatibility evidence is the official SDK client over an in-memory transport.
  The README says so instead of implying a live-host pass.
- #1162 wave 11 (independent security review) and the real-profile field run
  remain human-gated; this plan only corrects the record.
