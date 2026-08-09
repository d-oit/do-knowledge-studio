# Plan 111 — PR Sweep: DeepSource Config Root Cause + PR #624 Thread Remediation (2026-08-09)

**Status**: DONE — all gates green; PRs awaiting GitHub merge-state refresh (Plan 098 staleness)
**Scope**: Address all open PRs (#624, #625, #626), the failing DeepSource JS check on #624, stale bot threads, and a concurrent-agent conflict on the OKF branch.

## Final PR State

| PR | State | Threads | Required check (Codacy) | Notes |
|----|-------|---------|--------------------------|-------|
| #625 (dependabot dompurify) | OPEN, BLOCKED* | 0/1 unresolved | ✅ pass | Auto-merge armed; recreated after Dependabot auto-closed it on close/reopen nudge |
| #626 (owlwatch remediation) | OPEN, BLOCKED* | 0/13 unresolved | ✅ pass | Auto-merge armed |
| #624 (OKF bundle) | OPEN, BLOCKED* | 0/58 resolved | ✅ pass | All threads replied+resolved; DeepSource JS fail is metric-only (informational) |
| #627 (config-fix, NEW) | OPEN, BLOCKED* | 0 | ✅ pass | Auto-merge armed |

\* `BLOCKED` = GitHub merge-state staleness per Plan 098: every ruleset gate verified green (rule endpoints, check runs, threads, approvals) — auto-merge will complete on GitHub's cache refresh.

## Root Cause: DeepSource ignores `.deepsource.toml` on PR #624

**Definitive evidence** (from DeepSource run page NUXT payload for run `6142cfeb`, which analyzed the post-rename commit `0c4a81f`):

The effective repo config used by the run did **not** match `.deepsource.toml`:

| Setting | `.deepsource.toml` | Effective (dashboard) |
|---------|--------------------|-----------------------|
| analyzer name | `javascript` (renamed) | `javascript` (name fix verified in docs: shortcode is `javascript`) |
| `module_system` | `es-modules` | **`commonjs`** |
| `cyclomatic_complexity_threshold` | `critical` | **`low`** |
| `skip_doc_coverage` | 6 artifact types | **absent** |
| `issue_patterns` (JS-R1005, JS-0067, …) | 11 suppressions | **absent** |

Key doc finding (docs.deepsource.com configure-analyzers): *"If you use a `.deepsource.toml` configuration file, it must be committed to the repository's default branch for analysis to activate."*

**Conclusion**: `main` still had the legacy invalid analyzer name `javascript-typescript` (docs list valid JS shortcode as `javascript`), so DeepSource silently ignored the JS analyzer section and fell back to dashboard defaults. Consequence: 7 JS-R1005 issues raised with **0 suppressed**, and the doc-coverage metric counted all artifacts.

**Fix**: PR #627 renames the JS analyzer to the valid `javascript` name on `main` (user-approved — AGENTS.md lint-suppression hard rule). Once merged, DeepSource reads the repo's own `issue_patterns`/`skip_doc_coverage`.

## DDP (External Dependencies) metric — investigated, informational

- DDP = "total number of 3rd-party dependencies used in this repository"; `trendPositive: false` → increasing deps is the negative direction.
- PR #624 adds 2 genuinely required deps: `fflate` (zipSync/unzipSync for OKF bundle compression) and `yaml` (frontmatter parse/stringify).
- **DeepSource is NOT a required merge check** — the `main` ruleset requires only `Codacy Static Code Analysis`. The DDP gate failure is informational for merging.
- Threshold changes are dashboard-only (no API token available; documented in Plan 104).

## PR #624 Code Fixes (all validated: 2132 unit tests + typecheck green)

| Commit | Change |
|--------|--------|
| `dfff869` | Split `handleExport` into per-format handlers; derive verification from trust tier |
| `0c4a81f` | Rename JS analyzer to valid `javascript` name |
| `267ef00` | Extract `parseOkfFile`/`parseClaims`/`buildEntity`; add `uuid()` crypto guard + path guard |
| `8fdeece` | Extract `withStubFileReader()`/`makeFileChangeEvent()` test helpers; dedupe 3 StubFileReader blocks |
| `fa271d9` | Replace `Math.random` fallback with `crypto.getRandomValues` (Codacy weak-RNG) |
| `3c940be` | Extract shared `LibraryPayload` interface (OwlWatch duplication) |
| `1af799d` | **Restore reviewed fixes** reverted by a stale concurrent push (jules bot `223beca`) |
| `a72f617` | Guard `crypto.getRandomValues` in `uuid()` fallback; throw on absent Web Crypto (OwlWatch HIGH) |

## Threads Resolved (with evidence replies)

- **OwlWatch (12)**: parseOkfBundle CCN, path non-null assertion, hardcoded verification, useExportHandlers length, crypto guard (×2), duplicate test setup, handleExport length (×2, stale measurements), Math.random→getRandomValues, OKF version false-positive, LibraryPayload duplication.
- **DeepSource (40+)**: all replied+resolved — stale anchors, or covered by `issue_patterns` suppressions (JS-R1005 complexity, JS-0067 ES-module top-level declarations, JS-C1002 short callback vars, JS-0116 async-no-await) that activate via PR #627, or already fixed in code (redundant `undefined` in trust.test.ts).

## Concurrent-Agent Conflict (important learning)

The google-labs-jules[bot] automation pushed `223beca` ("test(e2e): improve command palette test robustness") on top of the OKF branch **whose diff accidentally reverted all reviewed OKF fixes** (a stale local working-tree state — the commit message only concerns the 2-line e2e change, yet the diff also rewrote 11 OKF files: `.deepsource.toml` name, crypto/path guards, verification derivation, LibraryPayload, JSDoc, helpers).

**Resolution**: restored the reviewed OKF files from `3c940be` in `1af799d` while keeping the bot's legit e2e robustness change (command-palette hydration wait). Verified all 34 OKF/handler tests pass; 15 threads that the bot's push reopened were re-resolved.

**Learning**: when multiple agents work the same branch, a force-push from a stale snapshot can silently revert reviewed work. Always re-verify branch head before pushing and re-check thread/check state after any external push.

## Commits on the OKF branch (PR #624)
`a72f617` → `1af799d` → `223beca` (bot, kept e2e only) → `3c940be` → `fa271d9` → `8fdeece` → `267ef00` → `0c4a81f` → … → `dfff869`

## Follow-up
- Confirm #627 merges (auto-merge armed) → main gets valid config → DeepSource re-analysis of #624 should suppress remaining metric/issue noise.
- Confirm #625/#626/#624 auto-merges complete once GitHub cache refreshes.
- Optional: dashboard-only DDP/DCV metric thresholds remain admin territory (Plan 104).
