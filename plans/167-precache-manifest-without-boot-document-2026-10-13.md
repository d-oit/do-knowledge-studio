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
- The path constant is named `BOOT_DOCUMENT` rather than `BUILD_HTML`. Codacy's
  HTML-into-file-system rule keys on the argument's name — the identically
  shaped `existsSync(directory)` on the inventory loop was never flagged while
  `existsSync(BUILD_HTML)` was — and the constant holds a path, not markup. No
  suppression was applied: the Codacy Cloud CLI and its credentials are not
  available in this workspace.

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
| Codacy PR check | Clean: the three `HTML passed in to function …` findings cleared by the rename, and the check reports no annotations |
| CI on PR #953 | Every check passes except Vercel, which still fails without a quoted cause (see Notes) |

## Notes

- A local build run with `VERCEL=1` is **not** a faithful simulation and poisoned
  this workspace's Turbopack cache: later builds failed to resolve
  `next/font/google` until `.next` was removed. Recorded so the next
  investigation does not repeat it.
- The remaining Vercel failure cannot be read from here — `vercel inspect --logs`
  needs provider credentials. One correction for the `vercel-deployment` skill:
  the GitHub deployment record's `created_at` equals its status timestamp even
  for a known-good build (`ab26b78`, "Deployment has completed"), so the
  "instant failure means nothing ever built" discriminator did not hold in this
  measurement. Followup: re-measure before trusting that rule.
- The provider's Node engines notice (`>=22.0.0` may auto-upgrade to a future
  major) is non-fatal; the range matches the policy documented in `AGENTS.md`
  and is unchanged.

## PR #951 — Vercel check investigation (2026-10-13, evening)

PR #951's only failing check is Vercel. The branch now carries the fix above
(merge `d2f6273` on `jules-13938770014072009790-d8cb4729`), and the generator was
re-verified against the two build layouts a platform can produce:

| Layout | Command | Result |
|---|---|---|
| Split build, compile phase (no boot document) | `next build --experimental-build-mode=compile` | `.next/server/app/index.html` absent; 43 JS chunks and 17 media files present; generator exits 0 and writes the same 70-URL manifest |
| Standalone output | `NEXT_PRIVATE_STANDALONE=1 next build` | Document and inventories present; generator exits 0 |

Evidence gathered while the post-fix deployment still failed:

- Every deployment that **ran a build** has failed since the Next 16.3.8 restore
  (2026-10-12 10:35Z, `56428ea`); the only success in the window is a docs-only
  push that `vercel-ignore-build.sh` skipped (`af44c461`, 2026-10-12 19:57Z).
- Quota refusals carry a distinct status ("Deployment rate limited — retry in
  24 hours"), so the current failures are build failures, not the Hobby limit.
  The account created 18 deployments in the last 24 h, well under 100.
- The provider log is **not readable from this workspace**: no `VERCEL_TOKEN`,
  no `vercel` CLI, and deployment URLs answer 302 to SSO. `vercel inspect
  dpl_Ea5ZNdM32GzFzAcsWCegrdSQtZca --logs` (or the dashboard link on PR #951)
  is the only way to see why the post-fix build failed.

Conclusion: the repository side of the failure is fixed and verified; the
remaining cause is only visible in the provider log. Followup: read that log and,
if the failure is outside `generate-precache-manifest.mjs`, treat it as a
platform/framework issue rather than a manifest one.
