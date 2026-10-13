# Plan 167 — Precache Manifest Without the Boot Document

**Date:** 2026-10-13

**Related:** [ADR 041](ADRs/041-offline-precache-scope-and-upgrade-identity.md),
Plan 161, Plan 166.

## Problem

A Vercel build completed `next build` — its log shows the route report with `/`
static — and then failed in `scripts/generate-precache-manifest.mjs`:

```text
[precache] /vercel/path0/.next/server/app/index.html not found.
Run `pnpm run build` first — the precache list is derived from the real build output.
```

The generator required one exact file path, so a build the platform completed
became a failed deployment. Every deployment since 2026-10-12 10:35Z failed
(`gh api repos/d-oit/do-knowledge-studio/commits/<sha>/status`), `main` included,
so production has not advanced.

## Evidence

- Local builds do emit `.next/server/app/index.html`; the difference is on the
  provider's side and was not reproducible here.
- The document scan is **redundant today**: using the generator's own extraction
  rules, all 22 assets the document references are already covered by the chunk
  inventory (45 files) and the media inventory (17 files) — 0 uncovered.
- The pre-fix behavior was re-created against a fixture with no document: exit 1
  and no manifest (`scripts/generate-precache-manifest.mjs` at `1f1fc50`).

## Change

- The boot-document scan is best-effort. When `.next/server/app/index.html`
  exists it is scanned exactly as before; when it does not, the manifest is
  written from the inventories and the run says so in one line.
- The hard requirements are unchanged: both static directories must exist, and
  the chunk inventory must hold at least one `.js`/`.mjs` file, or the run exits
  nonzero without writing anything.
- [ADR 041](ADRs/041-offline-precache-scope-and-upgrade-identity.md) §2 amended:
  it had recorded the old fail-closed-on-document rule.

## Verification

| Check | Result |
|---|---|
| `pnpm vitest run src/lib/studio/precache-manifest-generator.test.ts` | 4/4 pass — document present, document absent, missing chunk inventory, no JavaScript chunks |
| Same suite against the pre-fix script | Fails as expected: exit 1 and no manifest when the document is absent |
| Generator against the real build | Manifest byte-identical (70 URLs, no diff) |
| Real build with the document moved away | Exit 0, manifest byte-identical, one explanatory line |
| `pnpm run lint`, `pnpm run typecheck` | Clean |
| `pnpm run test:e2e:offline` | 6/6 passed against the production build |
| Minimal quality gate (pre-commit) | Green — 2,956 tests passed (1 skipped), 0 type errors |

## Notes

- A local build run with `VERCEL=1` is **not** a faithful simulation and poisoned
  this workspace's Turbopack cache: later builds failed to resolve
  `next/font/google` until `.next` was removed. Recorded so the next
  investigation does not repeat it.
- The provider's Node engines notice (`>=22.0.0` may auto-upgrade to a future
  major) is non-fatal; the range matches the policy documented in `AGENTS.md`
  and is unchanged.
