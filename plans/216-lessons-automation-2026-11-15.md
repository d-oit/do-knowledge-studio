# Plan 216 — Lessons automation (#1142)

## automated_by backfill

All 56 `lessons.jsonl` rows now carry `automated_by` (script/workflow path
or `null`). 18 automated, 38 prose-only. Genuine mappings only: each path
was verified to exist and to enforce the lesson (not merely mention it).

## Report

`scripts/lessons-report.mjs` (`pnpm run lessons:report`) lists prose-only
lessons grouped by first tag, most recurrent cluster first. Report-only by
design (always exits 0); wired into `scripts/verify.sh` so CI shows it.
Current top clusters: untagged (4), bash (3), ci (3).

## Three new failing-capable checks

1. **LESSON-024 (gitleaks v2 pin)** — `validate-github-actions-shas.sh`
   now rejects `gitleaks-action` on major ≥3 and pins without a `# vN`
   comment. Failing evidence: `tests/validate-gha-shas.bats` tests 9–10
   (v3 fixture, comment-less fixture) fail; test 11 (v2.3.9) and the real
   repo pin pass. 11/11 green.
2. **LESSON-042 (staged node_modules)** — `.githooks/pre-commit` refuses
   staged `node_modules` entries. Failing evidence: the old hook from git
   HEAD exits 0 on staged `node_modules/evil.js` with no refusal (fixture
   in /tmp, hooks identical except the guard); the new hook exits 1 with
   `LESSON-042` cited. `tests/pre-commit-hook.bats` 6/6 green.
3. **LESSON-047 (config arg only a cache key)** —
   `scripts/check-lint-config-wiring.mjs` (`pnpm run lessons:check`) fails
   any `lint_if_changed` call site that names a config without forwarding
   `--config` (shellcheck auto-discovery allowlisted with reason). Failing
   evidence: `tests/check-lint-config-wiring.bats` test 2 (flag dropped in
   fixture) fails; repo call sites pass. 3/3 green.

## Budget

`agents-docs/LESSONS.md` is now an 80-line index (one line per lesson +
link) with full write-ups in `agents-docs/lessons/NNN-slug.md` (56 files,
content preserved byte-for-byte from the split). `check-doc-consistency.mjs`
enforces: index ≤400 lines, index ↔ files ↔ jsonl same id set, each linked
file contains its heading. Passes.
