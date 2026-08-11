# Plan 111 — PR Sweep: DeepSource Config Root Cause + PR #624 Thread Remediation (2026-08-09)

**Status**: DONE — all gates green; PRs awaiting GitHub merge-state refresh (Plan 098 staleness)
**Scope**: Address all open PRs (#624, #625, #626), the failing DeepSource JS check on #624, stale bot threads, and a concurrent-agent conflict on the OKF branch.

## Final PR State

| PR | Threads | Required check (Codacy) | Notes |
|----|---------|--------------------------|-------|
| #625 (dependabot dompurify) | 0/1 unresolved | ✅ pass | Auto-merge armed; recreated after Dependabot auto-closed it on a close/reopen nudge |
| #626 (owlwatch remediation) | 0/13 unresolved | ✅ pass | Auto-merge armed |
| #624 (OKF bundle) | 0/62 resolved | ✅ pass | All threads replied+resolved; DeepSource JS fail is metric-only (informational) |
| #627 (config-fix, NEW) | 0 | ✅ pass | Auto-merge armed |

All four report `mergeStateStatus: BLOCKED` — **GitHub merge-state staleness** per Plan 098: every ruleset gate verified green via rule endpoints / check runs / thread counts / approvals. Auto-merge is armed on all; merges complete on GitHub's cache refresh.

## Root Cause: DeepSource ignores `.deepsource.toml` on PR #624

**Definitive evidence** (DeepSource run page NUXT payload, run `6142cfeb` analyzing post-rename commit `0c4a81f`):

| Setting | `.deepsource.toml` | Effective (dashboard) |
|---------|--------------------|-----------------------|
| analyzer name | `javascript` (renamed) | `javascript` (shortcode confirmed in docs) |
| `module_system` | `es-modules` | **`commonjs`** |
| `cyclomatic_complexity_threshold` | `critical` | **`low`** |
| `skip_doc_coverage` | 6 artifact types | **absent** |
| `issue_patterns` (JS-R1005, JS-0067, …) | 11 suppressions | **absent** |

Key doc finding: *"If you use a `.deepsource.toml` configuration file, it must be committed to the repository's default branch for analysis to activate."*

`main` still had the legacy invalid analyzer name `javascript-typescript`, so DeepSource ignored the JS analyzer section and used dashboard defaults → 7 JS-R1005 raised with 0 suppressed, doc-coverage metric counted all artifacts. **Fix**: PR #627 renames to `javascript` on `main` (user-approved; AGENTS.md lint-suppression hard rule).

## DDP (External Dependencies) metric — investigated, informational

- DDP = total 3rd-party deps used; `trendPositive: false` → increasing deps is the negative direction.
- #624 adds 2 genuinely required deps: `fflate` (zipSync/unzipSync for OKF bundles) and `yaml` (frontmatter).
- **DeepSource is NOT a required merge check** — ruleset requires only `Codacy Static Code Analysis`.
- Threshold changes are dashboard-only (no API token; Plan 104).

## PR #624 Code Fixes (all validated — 35 OKF/handler tests + typecheck green)

| Commit | Change |
|--------|--------|
| `dfff869` | Split `handleExport` into per-format handlers; derive verification from trust tier |
| `0c4a81f` | Rename JS analyzer to valid `javascript` name |
| `267ef00` | Extract `parseOkfFile`/`parseClaims`/`buildEntity`; add `uuid()` crypto guard + path guard |
| `8fdeece` | Extract `withStubFileReader()`/`makeFileChangeEvent()` test helpers; dedupe StubFileReader blocks |
| `fa271d9` | Replace `Math.random` fallback with `crypto.getRandomValues` (Codacy weak-RNG) |
| `3c940be` | Extract shared `LibraryPayload` interface (OwlWatch duplication) |
| `1af799d` | **Restore reviewed fixes** reverted by stale concurrent push (jules bot `223beca`) |
| `a72f617` | Guard `crypto.getRandomValues` in `uuid()` fallback; throw on absent Web Crypto (OwlWatch HIGH) |
| `68a9690` | Surface partial OKF import errors via warning toast; dedupe test preview fixture |
| `47a92c1` (bot) | Refine trust helpers (compatible: `trustTier` returns `'human-reviewed'`/`'machine-confirmed'`/`'unverified'`) |

## Threads Resolved (with evidence replies)

- **OwlWatch (14)**: parseOkfBundle CCN, path non-null assertion, hardcoded verification, useExportHandlers length, crypto guard (×2), duplicate test setup (×2), handleExport length (×2, stale measurements), Math.random→getRandomValues, OKF version false-positive, LibraryPayload duplication, partial-import errors ignored, cross-reference validation (by design, §11).
- **DeepSource (40+)**: stale anchors or covered by `issue_patterns` suppressions (JS-R1005, JS-0067, JS-C1002, JS-0116) activating via #627, or already fixed (redundant `undefined`).

## Concurrent-Agent Conflict (important learning)

google-labs-jules[bot] pushed `223beca` ("test(e2e): improve command palette test robustness") whose diff also **reverted all reviewed OKF fixes** — a stale local working-tree state (commit message only concerns the 2-line e2e change, yet it rewrote 11 OKF files). Resolved in `1af799d` by restoring reviewed files while keeping the bot's legit e2e change. Verified tests; re-resolved 15 threads the bot's push reopened.

**Learning**: with multiple agents on one branch, a force-push from a stale snapshot can silently revert reviewed work — always re-verify branch head before pushing and re-check threads/checks after any external push.

## Follow-up
- Confirm #627 merges → main gets valid config → DeepSource re-analysis of #624 suppresses remaining metric/issue noise.
- Confirm #625/#626/#624 auto-merges complete once GitHub cache refreshes.
- Dashboard-only DDP/DCV metric thresholds remain admin territory (Plan 104).
