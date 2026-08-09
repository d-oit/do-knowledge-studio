# Plan 111 — PR Sweep: DeepSource Config Root Cause + PR #624 Thread Remediation (2026-08-09)

**Status**: IN PROGRESS
**Scope**: Address all open PRs (#624, #625, #626), the failing DeepSource JS check on #624, and stale bot threads.

## Summary of Outcomes

| Item | State |
|------|-------|
| PR #625 (owlwatch dep bump) | Fully green, 0 threads, auto-merge armed — awaiting GitHub merge-state refresh (Plan 098 staleness) |
| PR #626 (owlwatch fixes) | Fully green, 0 threads (13 total, all resolved), auto-merge armed — awaiting refresh |
| PR #624 (OKF bundle) | Code findings fixed; 8 OwlWatch threads replied+resolved; DeepSource threads covered by config suppression |
| PR #627 (config-fix, NEW) | `fix(ci): rename JS analyzer to valid 'javascript' name` — all checks green, auto-merge armed — awaiting refresh |

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

**Fix**: PR #627 renames the JS analyzer to the valid `javascript` name on `main`. Once merged, DeepSource reads the repo's own `issue_patterns`/`skip_doc_coverage` and re-analysis of #624 should suppress the noise threads.

## DDP (External Dependencies) metric — investigated, informational

- DDP = "total number of 3rd-party dependencies used in this repository"; `trendPositive: false` → increasing deps is the negative direction.
- PR #624 adds 2 genuinely required deps: `fflate` (zipSync/unzipSync for OKF bundle compression) and `yaml` (frontmatter parse/stringify).
- **DeepSource is NOT a required merge check** — the `main` ruleset requires only `Codacy Static Code Analysis`. The DDP gate failure is informational for merging.
- Threshold changes are dashboard-only (no API token available; documented in Plan 104).

## PR #624 Thread Remediation

### OwlWatch (8 threads) — all replied + resolved with evidence
1. `parseOkfBundle` 25 CCN → fixed in `267ef00` (now 12-line orchestrator; `parseOkfFile`/`parseClaims`/`buildEntity` extracted)
2. File path non-null assertion → fixed in `267ef00` (`path.split('/').pop() ?? ''`)
3. Hardcoded verification status → fixed (derived from `trustTier(fm.verified)`, documented in `dfff869`)
4. `useExportHandlers` 176 lines → addressed (thin dispatcher; per-format handlers extracted)
5. Missing crypto global guard → fixed in `267ef00` (`uuid()` helper with typeof guard + RFC-4122 fallback)
6. Duplicate test setup → fixed in `8fdeece` (extracted `withStubFileReader()` + `makeFileChangeEvent()`)
7. `handleExport` 107 lines → resolved (was a ~20-line switch since `dfff869`; thread measured pre-split code)
8. Insecure Math.random UUID → fixed in `267ef00` (crypto.randomUUID primary; Math.random only fallback)

### DeepSource (25 threads) — classified, all covered
- 23 threads marked `outdated=True` (anchored to pre-refactor code)
- Remaining threads: JS-R1005 (complexity), JS-0067 (global scope), JS-C1002 (short vars), JS-0116 (async no-await), redundant `undefined` in `trust.test.ts` — **all covered by `issue_patterns` suppressions in `.deepsource.toml`** (JS-R1005, JS-0067, JS-C1002, JS-0116) or already fixed in current code (redundant `undefined` gone from `trust.test.ts`)
- Expected to auto-resolve after PR #627 lands and DeepSource re-analyzes with the repo config active.

## Commits on the OKF branch (PR #624)
- `0c4a81f` fix(ci): rename JS analyzer to valid 'javascript' name
- `267ef00` fix(okf): extract per-file parse loop, add crypto fallback, guard path parsing
- `8fdeece` test(okf): extract shared StubFileReader helper, dedupe import tests; fix dup JSDoc

## Follow-up
- Confirm #627 merges (auto-merge armed; Plan 098 staleness). Re-verify #624 DeepSource re-analysis shows suppressed issues; resolve any remaining bot threads; merge #624.
- Confirm #625/#626 auto-merges complete.
