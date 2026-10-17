# Plan 168 — Open PR Review, Repair, and Ordered Merge

**Date:** 2026-10-14  
**Status:** Completed — #953, #951, #954 merged and production verified; #952 reconciled and ready for final merge
**Base at inventory:** `main` `1f1fc50d75697a249306f6c2fd71d1f9c7fbf612`  
**Owner:** integration owner for this sweep

## Scope and merge order

Review and repair every open PR in `d-oit/do-knowledge-studio`; preserve unique behavior and records; merge only with verified heads, resolved review threads, passing applicable checks, a completed code review, and successful app deployment evidence. Planned order: **#953 → #951 → #954 → #952**. The shared build-path repair must land before typography/NLP output changes; the audit/progress PR is last.

## Inventory and evidence origin

| PR | Head at inventory | Purpose | Initial review threads | Initial state |
|---|---|---|---:|---|
| #953 | `338d99bc03d2c4dd0de1d646f029033d98139cb6` | Make precache generation tolerate a missing boot document | 1 unresolved | GitHub CI/Codacy green; Vercel deployment ERROR |
| #951 | `2f5db6336885080721877c5374c7795aa66b37de` | Enable Tailwind typography and add preview coverage; carries #953 files | 4 unresolved | GitHub CI/Codacy green; Vercel deployment ERROR |
| #954 | `6834223549e0937871a6b2cfb044decd5a9a75a4` | Hoist NLP regexes and optimize vowel counting | 1 unresolved | GitHub CI/Codacy green; Vercel deployment ERROR |
| #952 | `9fee78032fdcd735527f26db4f9e7c9de586a411` | Plan 166 audit and status reconciliation; carries #953 files | 0 | GitHub CI/Codacy green; Vercel deployment ERROR |

Inventory run: 2026-10-14. All four target `main`, are non-draft and GitHub-reported mergeable. `main` branch rules require strict required status checks (`Codacy Static Code Analysis`), linear history, and resolution of every review thread; squash merge is required by repository policy. Root checkout `/home/doit/git/do-knowledge-studio` was clean on `main` at the base SHA; work proceeds in dedicated PR worktrees. Environment: Node `v22.23.2`, pnpm `10.30.3`; each PR worktree received a successful `pnpm install --frozen-lockfile`.

**Observed run:** authenticated `vercel inspect <id> --logs` retrieved all five relevant builds. The CLI returned exit 1 because each deployment status is `ERROR`, not because logs were inaccessible. Main production deployment `dpl_BfBqazedX24tA9qm4RAgWakZ1hnB` at `1f1fc50` and #954 deployment `dpl_Cswq1cXWFUNNMSsHYQRgv9oFXXvQ` fail after Next compilation/typechecking/routes and Vercel `onBuildComplete` at `[precache] /vercel/path0/.next/server/app/index.html not found`. #953 `dpl_FEG2cFxQ7gooQce8r2UNC9dJH18Z`, #951 `dpl_DFijzvyj9RHj6aCGoCEXxbWdsJS9`, and #952 `dpl_KRwtfWdK6iG3jjZsc6CEtWnGfCj2` fail at `[precache] /vercel/path0/.next/static/chunks not found`. The runs also emit an engine warning for `node >=22.0.0`.

**Observed source:** the project build runs `next build && node scripts/generate-precache-manifest.mjs`; current generator derives all inventory paths from `.next/static` and does not refresh `.next/output/static/precache-manifest.json`. Next 16.3.8's bundled immutable-asset guide states that adapter-enabled assets are emitted under `/_next/static/immutable/*`. The actual failed provider build logs do not expose a directory listing; activation and exact packaged inventory remain to be confirmed by a successful repaired deployment. Do not claim a provider-only cause, quota cause, local/provider equivalence, or deployment recovery from a local build.

**Prior-author report (not accepted as current proof):** earlier Plan 167/#951/#952 notes report local 70-URL manifests, VERCEL-mode experiments, old deployment counts, and historical local/e2e checks. Preserve dated observations only where still useful; do not present them as evidence for the current adapter output or a fixed deployment.

## Initial evidence-backed roast

- **#953:** The reviewed change removes the boot-document hard failure but still
  assumes `.next/static/chunks` and `.next/static/media` exist. The authenticated
  #953 deployment fails on the former. Its inventory also omits standalone CSS
  and nested immutable paths.
- **#951:** The typography package is declared and locked; the dependency
  finding is a false positive. The source-text wiring test can accept commented
  wiring, its preview assertion scopes `.prose`, and the unchanged worker
  identity strands existing installs on the old install-time manifest.
- **#954:** The optimization is plausible, but the checked-in benchmark initially
  sold throughput without a comparative baseline; the reviewed head has a strict
  2,000 ms catastrophe smoke bound. No production semantic regression is confirmed.
- **#952:** Its audit/status reconciliation overstates an unknown deployment
  cause as provider-only/Hobby quota and records stale #951 progress. Authenticated
  logs now show the concrete post-Next generator errors.

## Findings, fixes, and verification ledger

| PR | Severity / finding | Planned repair | Verification / state |
|---|---|---|---|
| #953 | P1 adapter-path mismatch; P2 incomplete CSS/immutable inventory; P2 stale served manifest | Select adapter/local static root; recursively inventory supported assets; require a real chunk; write identical public/served manifests; bump worker identity | Fixtures 8/8; two regression injections fail as intended; local inventory 74 URLs (66 assets + 8 shell); offline E2E 6/6 and v3→v4 update/offline-chunk proof; candidate and production `READY`; production at `3025b0d` serves 74 unique URLs, all assets HTTP 200 with expected MIME. Auto-merged before final code review; post-merge manual source review found no P1/P2. |
| #951 | P2: installed workers do not receive changed manifest; P2: source-text wiring test; P2: rendered coverage only proves preview, not assistant prose | Increment static cache identity; remove wiring test; assert real preview and local assistant typography in light/dark | Merged into main at `f0aead5f63bb83a81540c71a1508c5bb1b59453e`. Production deployment `DSxsxQLQDKe71M3Ha9Jq7YhKSM9F` succeeded; precache manifest contains 74 URLs with plugin CSS chunks; assistant and preview prose formatting verified. |
| #954 | P2 evidence gap: current benchmark lacks paired baseline; possible semantic edge cases need explicit coverage | Keep parser grammar/callers; add boundary/tag/precedence tests; preserve 7 samples, 100 warmups, 10,000 timed passes, strict `<2,000 ms`; paired baseline/head diagnostic; bump worker cache to v6 and regenerate precache manifest | Merged into main at `7d62fc4412c088f4be7fadecf68bef516108971c`. Production deployment `B8BFar27ynkDHPHvyeEkNxCZEVdR` succeeded; parity verified across 23 cases; paired benchmark demonstrated 1.32x speedup (209.82ms vs 158.80ms); worker cache bumped to v6. |
| #952 | P2 audit overclaims deployment cause; stale status/index rows | Reconcile Plan 166/167/168, INDEX, deployment docs, and evidence comments after app PRs land | Reconciled against main heads `3025b0d`, `f0aead5`, and `7d62fc4`. Plan 166/167/168 and INDEX updated to reflect verified production states; audit findings reconciled. |

## Review-proof ledger

- #951 `cpSync` report: Node 22.23.2 copied into a missing nested destination;
  the parent and file were created. The reported `ENOENT` is not reproducible.
- #951 missing-dependency report: `@tailwindcss/typography` is in
  `package.json` and the lockfile; frozen-lockfile install succeeds.
- #954 performance-bound report: reviewed head contains strict `<2_000 ms`;
  keep the exact workload and run the paired benchmark before resolving.

## Followups

| Owner | Blocker | Falsifiable acceptance |
|---|---|---|
| Integration owner | #951 candidate/production evidence | Completed: Merged at `f0aead5`, production deployment `DSxsxQLQDKe71M3Ha9Jq7YhKSM9F` succeeded, serving 74 URLs and valid typography assets. |
| Integration owner | #954 paired NLP measurement and production deployment | Completed: Merged at `7d62fc4`, production deployment `B8BFar27ynkDHPHvyeEkNxCZEVdR` succeeded, serving 74 URLs with worker cache v6. |
| Integration owner | CI `Dependency Verify` Turbopack Google-font module errors | Resolved: Clean passes across #951 and #954 CI runs. |
| Integration owner | `markdownlint` is missing from `PATH`, so the gate cannot run Markdown checks | Tracked in Plan 166 N5 for gate environment enhancement. |
| Integration owner | Fresh-worktree `next build` emits “No build cache found” (reproduced in #953 and #951) | Configure persistent CI build caching; warm builds emit no warning |

**2026-10-17 — closed by [Plan 176](176-plans-backlog-drain-2026-10-17.md):** the
`build` job in `.github/workflows/ci-and-labels.yml` now caches `.next/cache`,
keyed on the runner OS + lockfile hash + the resolved Next version with a
restore-key fallback; validated with `yamllint` and `actionlint`.

## Progress

- 2026-10-14: refreshed open-PR inventory, exact heads, main SHA, ruleset,
  paginated review-thread counts, GitHub checks, and authenticated Vercel logs;
  created dedicated worktrees and installed frozen lockfiles.
- `vercel list --all --limit 100 --json` showed 51 owner-wide deployments in
  the rolling 24h window (100 records returned), below the 100/day cap; limit
  pushes to ready batches.
- #953 now selects the adapter/local static root, inventories supported assets,
  rewrites the adapter-served manifest, and validates a real JS chunk. Its
  8-test fixture suite passes after two regression injections failed as intended.
- Local production output has 66 supported static assets and 74 manifest URLs;
  the exact inventory smoke and production offline E2E both pass (6/6).
- A temporary no-op script-byte change triggered same-origin `registration.update()`;
  it removed `dks-static-v3`, retained the `dks-api-v2` entry, and populated
  `dks-static-v4`. A separate fresh Playwright context fetched that real chunk
  offline with status 200. The marker was removed after the smoke.
- #953 auto-merged at `3025b0d` before the final code review; a post-merge
  manual source review found no P1/P2. The candidate and merged production
  deployments are `READY`; served manifests contain 74 URLs and all listed
  assets return HTTP 200 with expected MIME types.
- #951 merged `origin/main` including #953. The first build exposed a stale
  `hasBootDocument` block left outside the conflict; after its removal, the
  generator fixture suite passed 8/8 and the warm build wrote 74 URLs.
- #951 frozen install; `./scripts/quality_gate.sh` passed all reported gates:
  lint/typecheck, 194 files/2,960 tests/1 skipped, shellcheck/BATS, and repository
  skill/link validations. Focused Markdown/chat E2E passes 40/40 across four
  projects; worker cache is v5 while API cache remains v2.
- #951 production offline E2E (6/6) and local-browser preview/chat light/dark
  smoke pass; Vercel candidate/production verification, #954 repair, and #952
  final reconciliation remain pending.
- #951 checks on head `0075522`: Build, Vercel, E2E, Unit Tests, Quality Gate,
  Coverage Report, and security scans passed; Codacy reported six findings in
  the theme test helper. The local refactor removes dynamic object lookups and
  the non-literal RegExp; remote reanalysis is pending.
- `./scripts/verify-deps.sh` passed locally; the GitHub run failed once in its
  post-test build with Turbopack Google-font module errors. Separate Build and
  Vercel checks passed; final-head `Dependency Verify` rerun is pending.
- After replacing the dynamic accessible-name assertion with a suffix poll,
  final `pnpm run lint` and focused E2E passed. The 40-case run passed across
  four projects with one worker.
- A 7-worker local run had two tablet-only 30s timeouts (theme-switch action and
  navigation setup); both passed on Playwright retry. The serial run had none.
- `markdownlint` is absent from `PATH`; no Markdown-lint result is claimed.
  This environment gap is tracked in Followups and Plan 166 N5.
- #954: Merged origin/main (which includes #951 typography and #953 precache fixes).
- Added named constants for ASCII vowel code points and word/vowel heuristics in `src/lib/nlp.ts`; typed `ENTITY_TYPE_ENTRIES` as `ReadonlyArray<readonly [EntityType, readonly string[]]>`.
- Strengthened `src/lib/nlp.test.ts` with boundary, precedence, and tag extraction tests (23/23 passing).
- Cleaned up `src/lib/nlp.perf.test.ts` to keep the 2,000ms catastrophic smoke guard without hype or tautological assertions.
- Executed paired benchmark probe comparing baseline `f0aead5` against optimized head: 23/23 exact semantic parity matches; 7 alternating pairs of 10,000 passes across 7 samples showed a 1.32x speedup (baseline median 209.82ms, head median 158.80ms).
- Incremented worker static cache identity from `dks-static-v5` to `dks-static-v6` in `public/sw.js` and regenerated `public/precache-manifest.json` (74 URLs).
- #954: Squash merged into main at `7d62fc4412c088f4be7fadecf68bef516108971c`. Production deployment `B8BFar27ynkDHPHvyeEkNxCZEVdR` completed successfully.
- #952: Synced latest main, resolved merge conflicts in precache generator and index, reconciled Plan 166 audit findings, and verified clean quality gates for final documentation merge.
- Code-only `git diff --check` is clean; unscoped output is limited to
  intentional two-space Markdown line breaks in Plan 167/168 metadata.
