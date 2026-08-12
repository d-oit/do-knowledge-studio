# Plan 118 — PR Sweep Session Summary (#624–#649)

Date: 2026-08-12
Status: RESOLVED

## Purpose

Record the full open-PR sweep session that reviewed, fixed, and merged the
open pull requests 624 through 649 (GOAP orchestration, no automerge).
Serves as a reference for future sweep sessions and as a pointer to the
plans/learnings produced.

## Session Phases

### Phase 1 — Review and remediation of the OKF export PR (#624)

- Reviewed the native Open Knowledge Format (OKF) v0.2 bundle export/import
  work and its PR-sweep plan (Plan 113).
- Fixed: `okf_version` validation on bundle import, import-error toast caps,
  slug-collision dedupe, path-map index titles, version read from
  package.json, unicode flag on truncation-assertion regex.
- Resolved all bot review threads (owl-watch, deepsource-io) before merge.

### Phase 2 — CI/quality remediation PRs (#626–#645)

- #626: owl-watch issue remediation (620–622) + Plan 111 reconciliation.
- #627/#628: DeepSource config activation and 28 repo-level Codacy issues.
- #629: TRIZ matrix index-order fix record.
- #638: `_detect_error_type` mapping and precedence test coverage.
- #639–#644: CI hardening track — dependabot auto-merge gate, workflow
  README + tests, reusable workflow templates, security-scan template,
  gitleaks-action pinned to v2.3.9 (removes paid license requirement).
- #645: gitleaks allowlist extended for test fixtures/doc examples.
- Dependabot batch (#630–#637): action + radix + tailwind bumps, all merged.

### Phase 3 — Learnings capture (docs)

- #646: CI/CD learnings — Plan 115 RESOLVED, Plan 116 created,
  LESSON-024 (gitleaks v3 license), LESSON-025 (yamllint), LESSON-026
  (bot threads block merges), AGENTS.md distilled Learnings section.

### Phase 4 — Search cache PR (#647)

- "Cache BM25 search index and entity map build" was the only remaining PR.
- BLOCKED by DeepSource: JavaScript (JS-R1005, `search` complexity 7).
- Fixed at code level: extracted `getIndex` cache helper (complexity 7→4),
  converted to arrow function after JS-0067 (LESSON-027, Plan 117).
- Added 3 cache-hit/invalidation tests; resolved DeepSource + owl-watch
  threads; merged; ~84% query-time reduction.

### Phase 5 — Post-merge verification and coverage (docs + tests)

- #648: LESSON-027 recorded (DeepSource JS-0067/JS-R1005 trap).
- #649: store-level tests proving `sendMessage` uses the reference cache
  correctly (cache hit, entity invalidation, claim invalidation).

### Phase 6 — Full quality gate on main (this session)

- Typecheck, ESLint, and production build: clean.
- Unit suite: 147 files, 2183 passed, 1 skipped.
- e2e (chromium): search-and-filter 8/8, ai-harness 14/14.
- Perf regression test strengthened: cold rebuild 16.12ms vs cached avg
  0.79ms on 1000 entities/3000 claims (~20x), with relative + absolute
  assertions (fails loudly if cache is removed).

## Key Outcomes

- 0 open PRs at session end; `main` at fe6d078 (verified green).
- Search cache: ~84% query-time reduction with invalidation coverage.
- gitleaks pinned to v2.3.9 — security-scan gate no longer requires a
  paid license.
- 4 new lessons (024–027) dual-written across LESSONS.md, lessons.jsonl,
  and AGENTS.md; plans 115–118 added.

## Process Notes for Future Sweeps

1. Merge in dependency order: check for impact before sequencing.
2. Never automerge — manual squash merges only, after CLEAN + no threads.
3. Bot threads (owl-watch, deepsource-io, dependabot) block merges even
   when checks pass — resolve or reply before merging.
4. Fix static-analysis findings at code level first; config suppressions
   do not reliably unblock DeepSource check failures.
5. Verify the full quality gate locally after the last merge; run e2e for
   search/chat paths when the search engine changes.
